document.addEventListener('DOMContentLoaded', () => {
  // i18n
  const t = chrome.i18n.getMessage;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.title = t('popupTitle');

  const DEFAULTS = {
    autoSkipEnabled: true,
    hotkeyCode: 'PageDown',
    speedDownKey: 'Comma',
    speedUpKey: 'Period'
  };

  // Element references
  const hotkeyInput = document.getElementById('hotkeyInput');
  const resetBtn = document.getElementById('resetBtn');
  const speedDownInput = document.getElementById('speedDownInput');
  const speedUpInput = document.getElementById('speedUpInput');
  const resetSpeedBtn = document.getElementById('resetSpeedBtn');
  const autoSkipToggle = document.getElementById('autoSkipToggle');
  const autoSkipStatus = document.getElementById('autoSkipStatus');

  const onText = t('autoSkipOn') || 'On';
  const offText = t('autoSkipOff') || 'Off';

  // Generic function to handle setting a hotkey
  function createKeyListener(inputElement, storageKey, originalPlaceholder) {
    inputElement.addEventListener('click', () => {
      inputElement.value = '';
      inputElement.placeholder = t('hotkeyPressNow') || 'Press a key…';

      const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = e.code; // Use layout-independent key code
        inputElement.value = code;
        chrome.storage.sync.set({ [storageKey]: code });

        window.removeEventListener('keydown', onKey, true);
        inputElement.blur();
        inputElement.placeholder = originalPlaceholder;
      };

      window.addEventListener('keydown', onKey, true);
    });
  }

  // Setup hotkey inputs
  createKeyListener(hotkeyInput, 'hotkeyCode', t('hotkeyPlaceholder'));
  createKeyListener(speedDownInput, 'speedDownKey', t('speedDownPlaceholder'));
  createKeyListener(speedUpInput, 'speedUpKey', t('speedUpPlaceholder'));

  // Reset buttons
  resetBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ hotkeyCode: DEFAULTS.hotkeyCode }, () => {
      hotkeyInput.value = DEFAULTS.hotkeyCode;
    });
  });

  resetSpeedBtn.addEventListener('click', () => {
    const newKeys = { speedDownKey: DEFAULTS.speedDownKey, speedUpKey: DEFAULTS.speedUpKey };
    chrome.storage.sync.set(newKeys, () => {
      speedDownInput.value = DEFAULTS.speedDownKey;
      speedUpInput.value = DEFAULTS.speedUpKey;
    });
  });

  // Auto-skip toggle
  function setAutoSkipStatus(enabled) {
    autoSkipStatus.textContent = enabled ? onText : offText;
  }

  autoSkipToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ autoSkipEnabled: enabled }, () => {
      setAutoSkipStatus(enabled);
    });
  });

  // Initial load from storage
  chrome.storage.sync.get(DEFAULTS, (items) => {
    hotkeyInput.value = items.hotkeyCode;
    speedDownInput.value = items.speedDownKey;
    speedUpInput.value = items.speedUpKey;
    autoSkipToggle.checked = !!items.autoSkipEnabled;
    setAutoSkipStatus(!!items.autoSkipEnabled);
  });
});
