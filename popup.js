document.addEventListener('DOMContentLoaded', () => {
  // i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
  });
  document.title = chrome.i18n.getMessage('popupTitle');

  const DEFAULTS = { autoSkipEnabled: true, hotkeyCode: 'PageDown' };

  const hotkeyInput = document.getElementById('hotkeyInput');
  const resetBtn = document.getElementById('resetBtn');
  const autoSkipToggle = document.getElementById('autoSkipToggle');
  const autoSkipStatus = document.getElementById('autoSkipStatus');

  const t = chrome.i18n.getMessage;
  const onText = t('autoSkipOn') || 'On';
  const offText = t('autoSkipOff') || 'Off';

  function setHotkeyDisplay(code) {
    hotkeyInput.value = code || '';
  }

  function setAutoSkipStatus(enabled) {
    autoSkipStatus.textContent = enabled ? onText : offText;
  }

  // 핫키 입력: input을 클릭하면 '키 리스너' 모드로 전환
  hotkeyInput.addEventListener('click', () => {
    hotkeyInput.value = '';
    hotkeyInput.placeholder = t('hotkeyPressNow') || 'Press a key…';

    // 일회성 리스너로 키를 기록
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = e.code; // 레이아웃 무관 코드
      setHotkeyDisplay(code);
      chrome.storage.sync.set({ hotkeyCode: code });
      // 해제
      window.removeEventListener('keydown', onKey, true);
      hotkeyInput.blur();
      hotkeyInput.placeholder = t('hotkeyPlaceholder') || 'Click then press a key';
    };
    window.addEventListener('keydown', onKey, true);
  });

  resetBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ hotkeyCode: DEFAULTS.hotkeyCode }, () => {
      setHotkeyDisplay(DEFAULTS.hotkeyCode);
    });
  });

  autoSkipToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ autoSkipEnabled: enabled }, () => {
      setAutoSkipStatus(enabled);
    });
  });

  // 초기 로드
  chrome.storage.sync.get(DEFAULTS, (items) => {
    setHotkeyDisplay(items.hotkeyCode);
    autoSkipToggle.checked = !!items.autoSkipEnabled;
    setAutoSkipStatus(!!items.autoSkipEnabled);
  });
});
