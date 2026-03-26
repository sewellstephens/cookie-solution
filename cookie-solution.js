// Cookie solution webflow - https://github.com/sewellstephens/cookie-solution/  

class SilktideCookieBanner {
  constructor(config) {
    this.config = config; // Save config to the instance

    this.wrapper = null;
    this.banner = null;
    this.modal = null;
    this.cookieIcon = null;
    this.cookieTriggerIsCustomLink = false;
    this.cookieIconDefaultDisplay = '';
    this.customTriggerObserver = null;
    this.customTriggerSelector = '';
    this.boundCustomTriggerHandler = null;
    this.customTriggerRetryTimer = null;
    this.customTriggerRetryCount = 0;
    this.maxCustomTriggerRetries = 20;
    this.backdrop = null;

    this.createWrapper();

    if (this.shouldShowBackdrop()) {
      this.createBackdrop();
    }

    this.createCookieIcon();
    this.createModal();

    if (this.shouldShowBanner()) {
      this.createBanner();
      this.showBackdrop();
    } else {
      this.showCookieIcon();
    }

    this.setupEventListeners();

    if (this.hasSetInitialCookieChoices()) {
      this.loadRequiredCookies();
      this.runAcceptedCookieCallbacks();
    }
  }

  destroyCookieBanner() {
    // Remove all cookie banner elements from the DOM
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }

    // Restore scrolling
    this.allowBodyScroll();

    // Clear all references
    this.wrapper = null;
    this.banner = null;
    this.modal = null;
    this.cookieIcon = null;
    if (this.customTriggerObserver) {
      this.customTriggerObserver.disconnect();
      this.customTriggerObserver = null;
    }
    if (this.customTriggerRetryTimer) {
      clearTimeout(this.customTriggerRetryTimer);
      this.customTriggerRetryTimer = null;
    }
    this.customTriggerRetryCount = 0;
    if (this.boundCustomTriggerHandler) {
      document.removeEventListener('click', this.boundCustomTriggerHandler, true);
      this.boundCustomTriggerHandler = null;
    }
    this.customTriggerSelector = '';
    this.backdrop = null;
  }

  // ----------------------------------------------------------------
  // Wrapper
  // ----------------------------------------------------------------
  createWrapper() {
    this.wrapper = document.createElement('div');
    this.wrapper.id = 'silktide-wrapper';
    document.body.insertBefore(this.wrapper, document.body.firstChild);
  }

  // ----------------------------------------------------------------
  // Wrapper Child Generator
  // ----------------------------------------------------------------
  createWrapperChild(htmlContent, id) {
    // Create child element
    const child = document.createElement('div');
    child.id = id;
    child.innerHTML = htmlContent;

    // Ensure wrapper exists
    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    // Append child to wrapper
    this.wrapper.appendChild(child);
    return child;
  }

  // ----------------------------------------------------------------
  // Backdrop
  // ----------------------------------------------------------------
  createBackdrop() {
    this.backdrop = this.createWrapperChild(null, 'silktide-backdrop');
  }

  showBackdrop() {
    if (this.backdrop) {
      this.backdrop.style.display = 'block';
    }
    // Trigger optional onBackdropOpen callback
    if (typeof this.config.onBackdropOpen === 'function') {
      this.config.onBackdropOpen();
    }
  }

  hideBackdrop() {
    if (this.backdrop) {
      this.backdrop.style.display = 'none';
    }

    // Trigger optional onBackdropClose callback
    if (typeof this.config.onBackdropClose === 'function') {
      this.config.onBackdropClose();
    }
  }

  shouldShowBackdrop() {
    return this.config?.background?.showBackground || false;
  }

  // update the checkboxes in the modal with the values from localStorage
  updateCheckboxState(saveToStorage = false) {
    const preferencesSection = this.modal.querySelector('#cookie-preferences');
    const checkboxes = preferencesSection.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox) => {
      const [, cookieId] = checkbox.id.split('cookies-');
      const cookieType = this.config.cookieTypes.find(type => type.id === cookieId);
      
      if (!cookieType) return;

      if (saveToStorage) {
        // Save the current state to localStorage and run callbacks
        const currentState = checkbox.checked;
        
        if (cookieType.required) {
          localStorage.setItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`,
            'true'
          );
        } else {
          localStorage.setItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`,
            currentState.toString()
          );
          
          // Run appropriate callback
          if (currentState && typeof cookieType.onAccept === 'function') {
            cookieType.onAccept();
          } else if (!currentState && typeof cookieType.onReject === 'function') {
            cookieType.onReject();
          }
        }
      } else {
        // When reading values (opening modal)
        if (cookieType.required) {
          checkbox.checked = true;
          checkbox.disabled = true;
        } else {
          const storedValue = localStorage.getItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`
          );
          
          if (storedValue !== null) {
            checkbox.checked = storedValue === 'true';
          } else {
            checkbox.checked = !!cookieType.defaultValue;
          }
        }
      }
    });
  }

  setInitialCookieChoiceMade() {
    window.localStorage.setItem(`silktideCookieBanner_InitialChoice${this.getBannerSuffix()}`, 1);
  }

  // ----------------------------------------------------------------
  // Consent Handling
  // ----------------------------------------------------------------
  handleCookieChoice(accepted) {
    // We set that an initial choice was made regardless of what it was so we don't show the banner again
    this.setInitialCookieChoiceMade();

    this.removeBanner();
    this.hideBackdrop();
    this.toggleModal(false);
    this.showCookieIcon();

    this.config.cookieTypes.forEach((type) => {
      // Set localStorage and run accept/reject callbacks
      if (type.required == true) {
        localStorage.setItem(`silktideCookieChoice_${type.id}${this.getBannerSuffix()}`, 'true');
        if (typeof type.onAccept === 'function') { type.onAccept() }
      } else {
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );

        if (accepted) {
          if (typeof type.onAccept === 'function') { type.onAccept(); }
        } else {
          if (typeof type.onReject === 'function') { type.onReject(); }
        }
      }
    });

    // Trigger optional onAcceptAll/onRejectAll callbacks
    if (accepted && typeof this.config.onAcceptAll === 'function') {
      if (typeof this.config.onAcceptAll === 'function') { this.config.onAcceptAll(); }
    } else if (typeof this.config.onRejectAll === 'function') {
      if (typeof this.config.onRejectAll === 'function') { this.config.onRejectAll(); }
    }

    // finally update the checkboxes in the modal with the values from localStorage
    this.updateCheckboxState();
  }

  getAcceptedCookies() {
    return (this.config.cookieTypes || []).reduce((acc, cookieType) => {
      acc[cookieType.id] =
        localStorage.getItem(`silktideCookieChoice_${cookieType.id}${this.getBannerSuffix()}`) ===
        'true';
      return acc;
    }, {});
  }

  runAcceptedCookieCallbacks() {
    if (!this.config.cookieTypes) return;

    const acceptedCookies = this.getAcceptedCookies();
    this.config.cookieTypes.forEach((type) => {
      if (type.required) return; // we run required cookies separately in loadRequiredCookies
      if (acceptedCookies[type.id] && typeof type.onAccept === 'function') {
        if (typeof type.onAccept === 'function') { type.onAccept(); }
      }
    });
  }

  runRejectedCookieCallbacks() {
    if (!this.config.cookieTypes) return;

    const rejectedCookies = this.getRejectedCookies();
    this.config.cookieTypes.forEach((type) => {
      if (rejectedCookies[type.id] && typeof type.onReject === 'function') {
        if (typeof type.onReject === 'function') { type.onReject(); }
      }
    });
  }

  /**
   * Run through all of the cookie callbacks based on the current localStorage values
   */
  runStoredCookiePreferenceCallbacks() {
    this.config.cookieTypes.forEach((type) => {
      const accepted =
        localStorage.getItem(`silktideCookieChoice_${type.id}${this.getBannerSuffix()}`) === 'true';
      // Set localStorage and run accept/reject callbacks
      if (accepted) {
        if (typeof type.onAccept === 'function') { type.onAccept(); }
      } else {
        if (typeof type.onReject === 'function') { type.onReject(); }
      }
    });
  }

  loadRequiredCookies() {
    if (!this.config.cookieTypes) return;
    this.config.cookieTypes.forEach((cookie) => {
      if (cookie.required && typeof cookie.onAccept === 'function') {
        if (typeof cookie.onAccept === 'function') { cookie.onAccept(); }
      }
    });
  }

  // ----------------------------------------------------------------
  // Banner
  // ----------------------------------------------------------------
  getBannerContent() {
    const bannerDescription =
      this.config.text?.banner?.description ||
      "<p>We use cookies on our site to enhance your user experience, provide personalized content, and analyze our traffic.</p>";

    // Accept button
    const acceptAllButtonText = this.config.text?.banner?.acceptAllButtonText || 'Accept all';
    const acceptAllButtonLabel = this.config.text?.banner?.acceptAllButtonAccessibleLabel;
    const acceptAllButton = `<button class="accept-all st-button st-button--primary"${
      acceptAllButtonLabel && acceptAllButtonLabel !== acceptAllButtonText 
        ? ` aria-label="${acceptAllButtonLabel}"` 
        : ''
    }>${acceptAllButtonText}</button>`;
    
    // Reject button
    const rejectNonEssentialButtonText = this.config.text?.banner?.rejectNonEssentialButtonText || 'Reject non-essential';
    const rejectNonEssentialButtonLabel = this.config.text?.banner?.rejectNonEssentialButtonAccessibleLabel;
    const rejectNonEssentialButton = `<button class="reject-all st-button st-button--primary"${
      rejectNonEssentialButtonLabel && rejectNonEssentialButtonLabel !== rejectNonEssentialButtonText 
        ? ` aria-label="${rejectNonEssentialButtonLabel}"` 
        : ''
    }>${rejectNonEssentialButtonText}</button>`;

    // Preferences button
    const preferencesButtonText = this.config.text?.banner?.preferencesButtonText || 'Preferences';
    const preferencesButtonLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel;
    const preferencesButton = `<button class="preferences"${
      preferencesButtonLabel && preferencesButtonLabel !== preferencesButtonText 
        ? ` aria-label="${preferencesButtonLabel}"` 
        : ''
    }><span>${preferencesButtonText}</span></button>`;
    

    // Silktide logo link
    const silktideLogo = `
      
    `;

    const bannerContent = `
      ${bannerDescription}
      <div class="actions">                               
        ${acceptAllButton}
        ${rejectNonEssentialButton}
        <div class="actions-row">
          ${preferencesButton}
          ${silktideLogo}
        </div>
      </div>
    `;

    return bannerContent;
  }

  hasSetInitialCookieChoices() {
    return !!localStorage.getItem(`silktideCookieBanner_InitialChoice${this.getBannerSuffix()}`);
  }

  createBanner() {
    // Create banner element
    this.banner = this.createWrapperChild(this.getBannerContent(), 'silktide-banner');

    // Add positioning class from config
    if (this.banner && this.config.position?.banner) {
      this.banner.classList.add(this.config.position.banner);
    }

    // Trigger optional onBannerOpen callback
    if (this.banner && typeof this.config.onBannerOpen === 'function') {
      this.config.onBannerOpen();
    }
  }

  removeBanner() {
    if (this.banner && this.banner.parentNode) {
      this.banner.parentNode.removeChild(this.banner);
      this.banner = null;

      // Trigger optional onBannerClose callback
      if (typeof this.config.onBannerClose === 'function') {
        this.config.onBannerClose();
      }
    }
  }

  shouldShowBanner() {
    if (this.config.showBanner === false) {
      return false;
    }
    return (
      localStorage.getItem(`silktideCookieBanner_InitialChoice${this.getBannerSuffix()}`) === null
    );
  }

  // ----------------------------------------------------------------
  // Modal
  // ----------------------------------------------------------------
  getModalContent() {
    const preferencesTitle =
      this.config.text?.preferences?.title || 'Customize your cookie preferences';
    
    const preferencesDescription =
      this.config.text?.preferences?.description ||
      "<p>We respect your right to privacy. You can choose not to allow some types of cookies. Your cookie preferences will apply across our website.</p>";
    
    // Preferences button
    const preferencesButtonLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel;

    const closeModalButton = `<button class="modal-close"${preferencesButtonLabel ? ` aria-label="${preferencesButtonLabel}"` : ''}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.4081 3.41559C20.189 2.6347 20.189 1.36655 19.4081 0.585663C18.6272 -0.195221 17.3591 -0.195221 16.5782 0.585663L10 7.17008L3.41559 0.59191C2.6347 -0.188974 1.36655 -0.188974 0.585663 0.59191C-0.195221 1.37279 -0.195221 2.64095 0.585663 3.42183L7.17008 10L0.59191 16.5844C-0.188974 17.3653 -0.188974 18.6335 0.59191 19.4143C1.37279 20.1952 2.64095 20.1952 3.42183 19.4143L10 12.8299L16.5844 19.4081C17.3653 20.189 18.6335 20.189 19.4143 19.4081C20.1952 18.6272 20.1952 17.3591 19.4143 16.5782L12.8299 10L19.4081 3.41559Z"/>
      </svg>
    </button>`;
    

    const cookieTypes = this.config.cookieTypes || [];
    const acceptedCookieMap = this.getAcceptedCookies();

    // Accept button
    const acceptAllButtonText = this.config.text?.banner?.acceptAllButtonText || 'Accept all';
    const acceptAllButtonLabel = this.config.text?.banner?.acceptAllButtonAccessibleLabel;
    const acceptAllButton = `<button class="preferences-accept-all st-button st-button--primary"${
      acceptAllButtonLabel && acceptAllButtonLabel !== acceptAllButtonText 
        ? ` aria-label="${acceptAllButtonLabel}"` 
        : ''
    }>${acceptAllButtonText}</button>`;
    
    // Reject button
    const rejectNonEssentialButtonText = this.config.text?.banner?.rejectNonEssentialButtonText || 'Reject non-essential';
    const rejectNonEssentialButtonLabel = this.config.text?.banner?.rejectNonEssentialButtonAccessibleLabel;
    const rejectNonEssentialButton = `<button class="preferences-reject-all st-button st-button--primary"${
      rejectNonEssentialButtonLabel && rejectNonEssentialButtonLabel !== rejectNonEssentialButtonText 
        ? ` aria-label="${rejectNonEssentialButtonLabel}"` 
        : ''
    }>${rejectNonEssentialButtonText}</button>`;
    
    

    const modalContent = `
      <header>
        <h1>${preferencesTitle}</h1>                    
        ${closeModalButton}
      </header>
      ${preferencesDescription}
      <section id="cookie-preferences">
        ${cookieTypes
          .map((type) => {
            const accepted = acceptedCookieMap[type.id];
            let isChecked = false;

            // if it's accepted then show as checked
            if (accepted) {
              isChecked = true;
            }

            // if nothing has been accepted / rejected yet, then show as checked if the default value is true
            if (!accepted && !this.hasSetInitialCookieChoices()) {
              isChecked = type.defaultValue;
            }

            return `
            <fieldset>
                <legend>${type.name}</legend>
                <div class="cookie-type-content">
                    <div class="cookie-type-description">${type.description}</div>
                    <label class="switch" for="cookies-${type.id}">
                        <input type="checkbox" id="cookies-${type.id}" ${
              type.required ? 'checked disabled' : isChecked ? 'checked' : ''
            } />
                        <span class="switch__pill" aria-hidden="true"></span>
                        <span class="switch__dot" aria-hidden="true"></span>
                        <span class="switch__off" aria-hidden="true">Off</span>
                        <span class="switch__on" aria-hidden="true">On</span>
                    </label>
                </div>
            </fieldset>
        `;
          })
          .join('')}
      </section>
      <footer>
        ${acceptAllButton}
        ${rejectNonEssentialButton}
      </footer>
    `;

    return modalContent;
  }

  createModal() {
    // Create banner element
    this.modal = this.createWrapperChild(this.getModalContent(), 'silktide-modal');
  }

  ensureUiElementsExist() {
    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    if (this.shouldShowBackdrop() && (!this.backdrop || !document.body.contains(this.backdrop))) {
      this.createBackdrop();
    }

    if (!this.modal || !document.body.contains(this.modal)) {
      this.createModal();
      this.setupModalEventListeners();
    }
  }

  openPreferencesModal() {
    this.ensureUiElementsExist();
    this.toggleModal(true);
  }

  toggleModal(show) {
    if (!this.modal) return;

    this.modal.style.display = show ? 'flex' : 'none';

    if (show) {
      this.showBackdrop();
      this.hideCookieIcon();
      this.removeBanner();
      this.preventBodyScroll();

      // Focus the close button
      const modalCloseButton = this.modal.querySelector('.modal-close');
      modalCloseButton.focus();

      // Trigger optional onPreferencesOpen callback
      if (typeof this.config.onPreferencesOpen === 'function') {
        this.config.onPreferencesOpen();
      }

      this.updateCheckboxState(false); // read from storage when opening
    } else {
      // Set that an initial choice was made when closing the modal
      this.setInitialCookieChoiceMade();
      
      // Save current checkbox states to storage
      this.updateCheckboxState(true);

      this.hideBackdrop();
      this.showCookieIcon();
      this.allowBodyScroll();

      // Trigger optional onPreferencesClose callback
      if (typeof this.config.onPreferencesClose === 'function') {
        this.config.onPreferencesClose();
      }
    }
  }

  findCookieTriggerElement(triggerIdOrSelector) {
    if (!triggerIdOrSelector) {
      return null;
    }

    const normalized = String(triggerIdOrSelector).trim();
    if (!normalized) {
      return null;
    }

    // Supports both "my-id" and "#my-id".
    const asId = normalized.startsWith('#') ? normalized.slice(1) : normalized;
    return document.getElementById(asId) || document.querySelector(normalized);
  }

  watchForCustomTrigger(triggerIdOrSelector) {
    if (!triggerIdOrSelector || this.customTriggerObserver || !document.body) {
      return;
    }

    this.customTriggerObserver = new MutationObserver(() => {
      const triggerEl = this.findCookieTriggerElement(triggerIdOrSelector);
      if (!triggerEl) {
        return;
      }

      this.cookieIcon = triggerEl;
      this.cookieTriggerIsCustomLink = true;
      this.cookieIconDefaultDisplay = this.cookieIcon.style.display || '';

      if (this.config.text?.banner?.preferencesButtonAccessibleLabel) {
        this.cookieIcon.ariaLabel = this.config.text.banner.preferencesButtonAccessibleLabel;
      }

      this.attachCookieTriggerClickListener();
      this.customTriggerObserver.disconnect();
      this.customTriggerObserver = null;
    });

    this.customTriggerObserver.observe(document.body, { childList: true, subtree: true });
  }

  scheduleCustomTriggerRetry(triggerIdOrSelector) {
    if (!triggerIdOrSelector || this.customTriggerRetryTimer) {
      return;
    }

    this.customTriggerRetryCount = 0;

    const tryBind = () => {
      const triggerEl = this.findCookieTriggerElement(triggerIdOrSelector);
      if (triggerEl) {
        this.cookieIcon = triggerEl;
        this.cookieTriggerIsCustomLink = true;
        this.cookieIconDefaultDisplay = this.cookieIcon.style.display || '';

        if (this.config.text?.banner?.preferencesButtonAccessibleLabel) {
          this.cookieIcon.ariaLabel = this.config.text.banner.preferencesButtonAccessibleLabel;
        }

        this.attachCookieTriggerClickListener();
        this.customTriggerRetryTimer = null;
        this.customTriggerRetryCount = 0;
        return;
      }

      this.customTriggerRetryCount += 1;
      if (this.customTriggerRetryCount >= this.maxCustomTriggerRetries) {
        this.customTriggerRetryTimer = null;
        return;
      }

      this.customTriggerRetryTimer = setTimeout(tryBind, 500);
    };

    this.customTriggerRetryTimer = setTimeout(tryBind, 250);
  }

  normalizeTriggerSelector(triggerIdOrSelector) {
    const normalized = String(triggerIdOrSelector || '').trim();
    if (!normalized) {
      return '';
    }

    // If caller passes a plain id like "cookie-link", normalize it to "#cookie-link".
    if (!normalized.startsWith('#') && !normalized.includes(' ') && !normalized.includes('[') && !normalized.includes('.')) {
      return `#${normalized}`;
    }

    return normalized;
  }

  openPreferencesModalFromTrigger() {
    this.openPreferencesModal();
    this.hideCookieIcon();

    // If modal is hidden, show it
    if (this.modal.style.display === 'flex') {
      return;
    }

    // If modal is visible, hide it
    this.toggleModal(false);
  }

  attachDelegatedCustomTriggerListener() {
    if (!this.customTriggerSelector || this.boundCustomTriggerHandler) {
      return;
    }

    this.boundCustomTriggerHandler = (event) => {
      const trigger = event.target?.closest?.(this.customTriggerSelector);
      if (!trigger) {
        return;
      }

      event.preventDefault();
      this.cookieIcon = trigger;
      this.openPreferencesModalFromTrigger();
    };

    document.addEventListener('click', this.boundCustomTriggerHandler, true);
  }

  attachCookieTriggerClickListener() {
    if (!this.cookieIcon || this.cookieIcon.dataset.silktideTriggerBound === 'true') {
      return;
    }

    this.cookieIcon.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      this.openPreferencesModalFromTrigger();
    });

    this.cookieIcon.dataset.silktideTriggerBound = 'true';
  }

  createCookieIcon() {
    const customTriggerId = this.config.customPageIdLink || this.config.cookieTriggerId;

    // Ensure legacy floating icons never show.
    const legacyIcon = document.getElementById('silktide-cookie-icon');
    if (legacyIcon) {
      legacyIcon.style.display = 'none';
    }

    this.customTriggerSelector = customTriggerId
      ? this.normalizeTriggerSelector(customTriggerId)
      : '';

    this.cookieIcon = customTriggerId
      ? this.findCookieTriggerElement(customTriggerId)
      : null;

    if (!this.cookieIcon) {
      if (customTriggerId) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn(
            '[SilktideCookieBanner] Custom trigger not found at init, watching for:',
            this.customTriggerSelector || customTriggerId,
          );
        }
        this.attachDelegatedCustomTriggerListener();
        this.watchForCustomTrigger(customTriggerId);
        this.scheduleCustomTriggerRetry(customTriggerId);
      }
      return;
    }

    this.cookieTriggerIsCustomLink = Boolean(customTriggerId);
    this.cookieIconDefaultDisplay = this.cookieIcon.style.display || '';

    if (this.cookieTriggerIsCustomLink) {
      this.attachDelegatedCustomTriggerListener();
    }

    if (this.config.text?.banner?.preferencesButtonAccessibleLabel) {
      this.cookieIcon.ariaLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel;
    }

    // Ensure wrapper exists
    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    // Custom trigger stays in-place in the page DOM.
  }

  showCookieIcon() {
    if (this.cookieIcon) {
      if (this.cookieTriggerIsCustomLink) {
        return;
      }
      this.cookieIcon.style.display = 'flex';
    }
  }

  hideCookieIcon() {
    if (this.cookieIcon) {
      if (this.cookieTriggerIsCustomLink) {
        return;
      }
      this.cookieIcon.style.display = 'none';
    }
  }

  /**
   * This runs if the user closes the modal without making a choice for the first time
   * We apply the default values and the necessary values as default
   */
  handleClosedWithNoChoice() {
    this.config.cookieTypes.forEach((type) => {
      let accepted = true;
      // Set localStorage and run accept/reject callbacks
      if (type.required == true || type.defaultValue) {
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );
      } else {
        accepted = false;
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );
      }

      if (accepted) {
        if (typeof type.onAccept === 'function') { type.onAccept(); }
      } else {
        if (typeof type.onReject === 'function') { type.onReject(); }
      }
      // set the flag to say that the cookie choice has been made
      this.setInitialCookieChoiceMade();
      this.updateCheckboxState();
    });
  }

  // ----------------------------------------------------------------
  // Focusable Elements
  // ----------------------------------------------------------------
  getFocusableElements(element) {
    return element.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
  }

  // ----------------------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------------------
  setupModalEventListeners() {
    if (!this.modal) {
      return;
    }

    const closeButton = this.modal.querySelector('.modal-close');
    const acceptAllButton = this.modal.querySelector('.preferences-accept-all');
    const rejectAllButton = this.modal.querySelector('.preferences-reject-all');

    closeButton?.addEventListener('click', () => {
      this.toggleModal(false);

      const hasMadeFirstChoice = this.hasSetInitialCookieChoices();

      if (hasMadeFirstChoice) {
        this.runStoredCookiePreferenceCallbacks();
      } else {
        this.handleClosedWithNoChoice();
      }
    });
    acceptAllButton?.addEventListener('click', () => this.handleCookieChoice(true));
    rejectAllButton?.addEventListener('click', () => this.handleCookieChoice(false));

    const focusableElements = this.getFocusableElements(this.modal);
    const firstFocusableEl = focusableElements[0];
    const lastFocusableEl = focusableElements[focusableElements.length - 1];

    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusableEl) {
            lastFocusableEl.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableEl) {
            firstFocusableEl.focus();
            e.preventDefault();
          }
        }
      }
      if (e.key === 'Escape') {
        this.toggleModal(false);
      }
    });

    closeButton?.focus();

    const preferencesSection = this.modal.querySelector('#cookie-preferences');
    const checkboxes = preferencesSection.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (event) => {
        const [, cookieId] = event.target.id.split('cookies-');
        const isAccepted = event.target.checked;
        const previousValue = localStorage.getItem(
          `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`
        ) === 'true';

        if (isAccepted !== previousValue) {
          const cookieType = this.config.cookieTypes.find(type => type.id === cookieId);

          if (cookieType) {
            localStorage.setItem(
              `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`,
              isAccepted.toString()
            );

            if (isAccepted && typeof cookieType.onAccept === 'function') {
              cookieType.onAccept();
            } else if (!isAccepted && typeof cookieType.onReject === 'function') {
              cookieType.onReject();
            }
          }
        }
      });
    });
  }

  setupEventListeners() {
    // Check Banner exists before trying to add event listeners
    if (this.banner) {
      // Get the buttons
      const acceptButton = this.banner.querySelector('.accept-all');
      const rejectButton = this.banner.querySelector('.reject-all');
      const preferencesButton = this.banner.querySelector('.preferences');

      // Add event listeners to the buttons
      acceptButton?.addEventListener('click', () => this.handleCookieChoice(true));
      rejectButton?.addEventListener('click', () => this.handleCookieChoice(false));
      preferencesButton?.addEventListener('click', () => {
        this.showBackdrop();
        this.toggleModal(true);
      });

      // Focus Trap
      const focusableElements = this.getFocusableElements(this.banner);
      const firstFocusableEl = focusableElements[0];
      const lastFocusableEl = focusableElements[focusableElements.length - 1];

      // Add keydown event listener to handle tab navigation
      this.banner.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstFocusableEl) {
              lastFocusableEl.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastFocusableEl) {
              firstFocusableEl.focus();
              e.preventDefault();
            }
          }
        }
      });

      // Set initial focus
      if (this.config.mode !== 'wizard') {
        acceptButton?.focus();
      }
    }

    // Check Modal exists before trying to add event listeners
    this.setupModalEventListeners();

    // Check Cookie Icon exists before trying to add event listeners
    this.attachCookieTriggerClickListener();
  }

  getBannerSuffix() {
    if (this.config.bannerSuffix) {
      return '_' + this.config.bannerSuffix;
    }
    return '';
  }

  preventBodyScroll() {
    document.body.style.overflow = 'hidden';
    // Prevent iOS Safari scrolling
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }

  allowBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }
}

(function () {
  window.silktideCookieBannerManager = {};

  let config = {};
  let cookieBanner;

  function updateCookieBannerConfig(userConfig = {}) {
    config = {...config, ...userConfig};

    // If cookie banner exists, destroy and recreate it with new config
    if (cookieBanner) {
      cookieBanner.destroyCookieBanner(); // We'll need to add this method
      cookieBanner = null;
    }

    // Only initialize if document.body exists
    if (document.body) {
      initCookieBanner();
    } else {
      // Wait for DOM to be ready
      document.addEventListener('DOMContentLoaded', initCookieBanner, {once: true});
    }
  }

  function initCookieBanner() {
    if (!cookieBanner) {
      cookieBanner = new SilktideCookieBanner(config); // Pass config to the CookieBanner instance
    }
  }

  function injectScript(url, loadOption) {
    // Check if script with this URL already exists
    const existingScript = document.querySelector(`script[src="${url}"]`);
    if (existingScript) {
      return; // Script already exists, don't add it again
    }

    const script = document.createElement('script');
    script.src = url;

    // Apply the async or defer attribute based on the loadOption parameter
    if (loadOption === 'async') {
      script.async = true;
    } else if (loadOption === 'defer') {
      script.defer = true;
    }

    document.head.appendChild(script);
  }

  window.silktideCookieBannerManager.initCookieBanner = initCookieBanner;
  window.silktideCookieBannerManager.updateCookieBannerConfig = updateCookieBannerConfig;
  window.silktideCookieBannerManager.injectScript = injectScript;
  window.silktideCookieBannerManager.openPreferences = function () {
    if (cookieBanner) {
      cookieBanner.openPreferencesModal();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner, {once: true});
  } else {
    initCookieBanner();
  }
})();