(function () {
  'use strict';

  // ===== 기본 설정/상태 =====
  const DEFAULTS = {
    autoSkipEnabled: true,
    hotkeyCode: 'PageDown' // Popup에서 변경 가능
  };

  const OBSERVER_TIMEOUT_MS = 30_000;
  const SCAN_INTERVAL_MS = 250;
  const CLICK_DEBOUNCE_MS = 2_000;
  const NEXT_CLICK_DEBOUNCE_MS = 800;

  let config = { ...DEFAULTS };

  let mo = null;
  let scanTimer = null;
  let observerKillTimer = null;
  let lastClickAt = 0;
  let lastNextClickAt = 0;
  let lastObservedUrl = location.href;
  let inited = false;

  // ===== 공통 유틸 =====
  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
           style.visibility !== 'hidden' &&
           style.display !== 'none' &&
           el.offsetParent !== null;
  }

  // ===== (A) 오프닝 스킵 버튼 – 트리 기반 탐색 =====
  // <div class="absolute w-full bottom-24">
  //   <div class="PcSkipOpeningButton_overlayButton__*">
  //     <button type="button">...</button>
  //   </div>
  // </div>
  function findSkipOpeningButton(root = document) {
    // 빠른 단일 셀렉터 시도
    let btn = root.querySelector(
      'div.absolute.w-full.bottom-24 > div[class^="PcSkipOpeningButton_overlayButton"] > button[type="button"]'
    );
    if (btn && isVisible(btn)) return btn;

    // 보강: 다중 후보 순회
    const containers = root.querySelectorAll('div.absolute.w-full.bottom-24');
    for (const c of containers) {
      const overlay = c.querySelector('div[class^="PcSkipOpeningButton_overlayButton"]');
      if (!overlay) continue;
      const b = overlay.querySelector('button[type="button"]');
      if (b && isVisible(b)) return b;
    }
    return null;
  }

  function clickOnce(btn) {
    const now = Date.now();
    if (now - lastClickAt < CLICK_DEBOUNCE_MS) return false;
    lastClickAt = now;
    // 필요한 경우 MouseEvent로 교체 가능
    btn.click();
    return true;
  }

  // ===== (B) 다음 화 버튼 – 트리 기반 탐색 =====
  // <div class="PcNextEpisodeButton_wrap__*">
  //   ...
  //   <button type="button">...</button>
  // </div>
  function findNextEpisodeButton(root = document) {
    const container = root.querySelector('div[class^="PcNextEpisodeButton_wrap__"]');
    if (!container) return null;
    const btn = container.querySelector('button[type="button"]');
    return btn && isVisible(btn) ? btn : null;
  }

  function clickNextEpisode() {
    const now = Date.now();
    if (now - lastNextClickAt < NEXT_CLICK_DEBOUNCE_MS) return false;
    const btn = findNextEpisodeButton();
    if (!btn) return false;
    lastNextClickAt = now;
    btn.click();
    return true;
  }

  // ===== 옵저버 라운드 =====
  function stopObserving() {
    if (mo) { try { mo.disconnect(); } catch {} mo = null; }
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (observerKillTimer) { clearTimeout(observerKillTimer); observerKillTimer = null; }
  }

  function startObservingRound() {
    if (!config.autoSkipEnabled) return; // OFF이면 동작 금지

    stopObserving();

    // 즉시 한 번 시도
    const first = findSkipOpeningButton();
    if (first && clickOnce(first)) { stopObserving(); return; }

    // 변경 감시
    mo = new MutationObserver(() => {
      const btn = findSkipOpeningButton();
      if (btn && clickOnce(btn)) stopObserving();
    });
    try {
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch {}

    // 폴백 스캔
    scanTimer = setInterval(() => {
      const btn = findSkipOpeningButton();
      if (btn && clickOnce(btn)) stopObserving();
    }, SCAN_INTERVAL_MS);

    // 안전 타임아웃
    observerKillTimer = setTimeout(stopObserving, OBSERVER_TIMEOUT_MS);
  }

  // ===== URL 변경 감지 =====
  function installUrlChangeHooks() {
    const wrap = (type) => {
      const orig = history[type];
      if (typeof orig === 'function') {
        history[type] = function () {
          const ret = orig.apply(this, arguments);
          onUrlMaybeChanged();
          return ret;
        };
      }
    };
    wrap('pushState'); wrap('replaceState');
    window.addEventListener('popstate', onUrlMaybeChanged);
    window.addEventListener('hashchange', onUrlMaybeChanged);
    setInterval(onUrlMaybeChanged, 500);
  }

  function onUrlMaybeChanged() {
    if (location.href !== lastObservedUrl) {
      lastObservedUrl = location.href;
      if (config.autoSkipEnabled) startObservingRound();
    }
  }

  // ===== 키 입력 처리 (기본 PageDown) =====
  function isEditable(el) {
    return (
      el &&
      (el.tagName === 'INPUT' ||
       el.tagName === 'TEXTAREA' ||
       el.isContentEditable)
    );
  }

  function installKeyHandler() {
    // capture 단계에서 먼저 잡아 스크롤(PageDown) 방지
    window.addEventListener('keydown', (e) => {
      try {
        if (!config.hotkeyCode) return;
        if (isEditable(document.activeElement)) return; // 입력창에서는 비활성
        if (e.code !== config.hotkeyCode) return;

        // PageDown 기본 스크롤 억제(요청 기능 우선)
        e.preventDefault();
        e.stopPropagation();

        clickNextEpisode();
      } catch {}
    }, true);
  }

  // ===== 설정 로드/감시 =====
  function loadConfigAndInit() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      config = { ...DEFAULTS, ...items };

      if (!inited) {
        inited = true;
        installUrlChangeHooks();
        installKeyHandler();
      }

      // 첫 로드 라운드
      if (config.autoSkipEnabled) startObservingRound();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if ('autoSkipEnabled' in changes) {
      config.autoSkipEnabled = changes.autoSkipEnabled.newValue;
      if (config.autoSkipEnabled) startObservingRound();
      else stopObserving();
    }
    if ('hotkeyCode' in changes) {
      config.hotkeyCode = changes.hotkeyCode.newValue;
    }
  });

  // 초기화
  loadConfigAndInit();
})();
