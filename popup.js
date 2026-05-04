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
    hideOverlayEnabled: true,
    hotkeyCode: 'PageDown',
    speedDownKey: 'Comma',
    speedUpKey: 'Period',
    speedNormalKey: 'Slash'
  };

  // Element references
  const hotkeyInput = document.getElementById('hotkeyInput');
  const resetBtn = document.getElementById('resetBtn');
  const speedDownInput = document.getElementById('speedDownInput');
  const speedUpInput = document.getElementById('speedUpInput');
  const speedNormalInput = document.getElementById('speedNormalInput');
  const resetSpeedBtn = document.getElementById('resetSpeedBtn');
  const autoSkipToggle = document.getElementById('autoSkipToggle');
  const autoSkipStatus = document.getElementById('autoSkipStatus');
  const hideOverlayToggle = document.getElementById('hideOverlayToggle');
  const hideOverlayStatus = document.getElementById('hideOverlayStatus');

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

        // 중복 체크
        chrome.storage.sync.get(DEFAULTS, (items) => {
          const keys = {
            hotkeyCode: items.hotkeyCode,
            speedDownKey: items.speedDownKey,
            speedUpKey: items.speedUpKey,
            speedNormalKey: items.speedNormalKey
          };
          
          // 현재 수정하려는 키는 제외하고 체크
          delete keys[storageKey];
          
          if (Object.values(keys).includes(code)) {
            // 중복된 경우 시각적 피드백 (간단히 배경색 빨간색으로 깜빡임 등 처리 가능)
            inputElement.style.backgroundColor = '#ffcccc';
            setTimeout(() => { inputElement.style.backgroundColor = ''; }, 500);
            return;
          }

          inputElement.value = code;
          chrome.storage.sync.set({ [storageKey]: code });

          window.removeEventListener('keydown', onKey, true);
          inputElement.blur();
          inputElement.placeholder = originalPlaceholder;
        });
      };

      window.addEventListener('keydown', onKey, true);
    });
  }

  // Setup hotkey inputs
  createKeyListener(hotkeyInput, 'hotkeyCode', t('hotkeyPlaceholder'));
  createKeyListener(speedDownInput, 'speedDownKey', t('speedDownPlaceholder'));
  createKeyListener(speedUpInput, 'speedUpKey', t('speedUpPlaceholder'));
  createKeyListener(speedNormalInput, 'speedNormalKey', t('speedNormalPlaceholder'));

  // Reset buttons
  resetBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ hotkeyCode: DEFAULTS.hotkeyCode }, () => {
      hotkeyInput.value = DEFAULTS.hotkeyCode;
    });
  });

  resetSpeedBtn.addEventListener('click', () => {
    const newKeys = { 
      speedDownKey: DEFAULTS.speedDownKey, 
      speedUpKey: DEFAULTS.speedUpKey,
      speedNormalKey: DEFAULTS.speedNormalKey
    };
    chrome.storage.sync.set(newKeys, () => {
      speedDownInput.value = DEFAULTS.speedDownKey;
      speedUpInput.value = DEFAULTS.speedUpKey;
      speedNormalInput.value = DEFAULTS.speedNormalKey;
    });
  });

  // Auto-skip toggle
  function setStatusText(element, enabled) {
    element.textContent = enabled ? onText : offText;
  }

  autoSkipToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ autoSkipEnabled: enabled }, () => {
      setStatusText(autoSkipStatus, enabled);
    });
  });

  hideOverlayToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ hideOverlayEnabled: enabled }, () => {
      setStatusText(hideOverlayStatus, enabled);
    });
  });

  // Initial load from storage
  chrome.storage.sync.get(DEFAULTS, (items) => {
    hotkeyInput.value = items.hotkeyCode;
    speedDownInput.value = items.speedDownKey;
    speedUpInput.value = items.speedUpKey;
    speedNormalInput.value = items.speedNormalKey;
    
    autoSkipToggle.checked = !!items.autoSkipEnabled;
    setStatusText(autoSkipStatus, !!items.autoSkipEnabled);
    
    hideOverlayToggle.checked = !!items.hideOverlayEnabled;
    setStatusText(hideOverlayStatus, !!items.hideOverlayEnabled);
  });
});
