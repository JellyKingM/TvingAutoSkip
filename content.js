(function () {
	'use strict';

	// ===== 기본 설정/상태 =====
	const DEFAULTS = {
		autoSkipEnabled: true,
		hotkeyCode: 'PageDown', // Popup에서 변경 가능
		speedDownKey: 'Comma',
		speedUpKey: 'Period'
	};

	const OBSERVER_TIMEOUT_MS = 30_000;
	const SCAN_INTERVAL_MS = 250;
	const CLICK_DEBOUNCE_MS = 2_000;
	const NEXT_CLICK_DEBOUNCE_MS = 800;

	let config = { ...DEFAULTS };

	let mo = null;
	let scanTimer = null;
	let observerKillTimer = null;
	let testSiblingObserver = null;
	let lastClickAt = 0;
	let lastNextClickAt = 0;
	let lastObservedUrl = location.href;
	let inited = false;

	function isPlayerPage() {
		return location.pathname.startsWith('/player/');
	}

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
	function findSkipOpeningButton(root = document) {
		let btn = root.querySelector(
			'div.absolute.w-full.bottom-24 > div > button[type="button"]'
		);
		if (btn && isVisible(btn)) return btn;

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
		btn.click();
		return true;
	}

	// ===== (B) 다음 화 버튼 – 트리 기반 탐색 =====
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

	// ===== (C) 배속 버튼 탐색 및 키 핸들러 =====
	function findSpeedButtons() {
		// 'control-button' 클래스를 가진 버튼들 중 첫번째 요소의 부모의 다음 형제의 모든 버튼을 리스트업
		const controlBtns = document.querySelectorAll('button.control-button');
		if (!controlBtns.length) return [];
		const firstControlBtn = controlBtns[0];
		const parent = firstControlBtn.parentElement;
		if (!parent) return [];
		let nextSibling = parent.nextElementSibling;
		// 만약 바로 다음 형제가 없으면, 부모의 부모에서 다음 형제를 찾음 (유연성 확보)
		if (!nextSibling && parent.parentElement) {
			nextSibling = parent.parentElement.nextElementSibling;
		}
		if (!nextSibling) return [];
		// 계층 상관없이 모든 버튼
		const buttons = Array.from(nextSibling.querySelectorAll('button'));
		return buttons.filter(isVisible);
	}

	function getActiveSpeedButtonIdx(buttons) {
		return buttons.findIndex(btn => btn.classList.contains('PcPlayerMenu_active__HiYjc'));
	}

	// ===== (E) 배속 표시 오버레이 =====
	let speedOverlayTimer = null;
	function showSpeedOverlay(speed) {
		let overlay = document.getElementById('tving-auto-skip-speed-overlay');
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'tving-auto-skip-speed-overlay';
			Object.assign(overlay.style, {
				position: 'fixed',
				top: '40px',
				right: '40px',
				padding: '10px 20px',
				backgroundColor: 'rgba(255, 255, 255, 0.6)',
				color: 'rgba(0, 0, 0, 0.6)',
				fontSize: '2rem',
				fontWeight: 'bold',
				borderRadius: '15px',
				zIndex: '999999',
				pointerEvents: 'none',
				transition: 'opacity 0.2s ease-in-out',
				display: 'none',
				fontFamily: 'sans-serif'
			});
			document.body.appendChild(overlay);
		}

		overlay.textContent = `${speed}x`;
		overlay.style.display = 'block';
		overlay.style.opacity = '1';

		if (speedOverlayTimer) clearTimeout(speedOverlayTimer);
		speedOverlayTimer = setTimeout(() => {
			overlay.style.opacity = '0';
			setTimeout(() => {
				if (overlay.style.opacity === '0') overlay.style.display = 'none';
			}, 200);
		}, 1000);
	}

	function handleSpeedKey(e) {
		if (isEditable(document.activeElement)) return;
		if (e.code !== config.speedDownKey && e.code !== config.speedUpKey) return;

		const video = document.querySelector('video');
		if (!video) return;

		// 1. 첫번째 control-button에 mouseover 이벤트 디스패치
		const controlBtns = document.querySelectorAll('button.control-button');
		let hoveredBtn = null;
		if (controlBtns.length > 0) {
			hoveredBtn = controlBtns[0];
			const mouseOverEvent = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
			hoveredBtn.dispatchEvent(mouseOverEvent);
		}

		// 2. 배속 버튼 탐색 및 클릭
		const buttons = findSpeedButtons();
		let speedChanged = false;

		if (buttons.length > 0) {
			const idx = getActiveSpeedButtonIdx(buttons);
			if (idx !== -1) {
				if (e.code === config.speedDownKey) {
					if (idx > 0) {
						buttons[idx - 1].click();
						speedChanged = true;
					} else {
						// 최소 버튼일 때 직접 조절
						const newRate = Math.max(0.25, video.playbackRate - 0.25);
						video.playbackRate = newRate;
						speedChanged = true;
					}
				} else if (e.code === config.speedUpKey) {
					if (idx < buttons.length - 1) {
						buttons[idx + 1].click();
						speedChanged = true;
					} else {
						// 최대 버튼일 때 직접 조절
						video.playbackRate += 0.25;
						speedChanged = true;
					}
				}
			}
		} else {
			// 버튼을 못 찾았을 경우 직접 조절 폴백
			if (e.code === config.speedDownKey) {
				video.playbackRate = Math.max(0.25, video.playbackRate - 0.25);
				speedChanged = true;
			} else if (e.code === config.speedUpKey) {
				video.playbackRate += 0.25;
				speedChanged = true;
			}
		}

		if (speedChanged) {
			e.preventDefault();
			e.stopPropagation();
			
			// 배속 변경이 반영될 시간을 고려하여 지연 표시
			setTimeout(() => {
				showSpeedOverlay(video.playbackRate);
			}, 50);
		}

		// 3. 배속버튼 클릭 후 마우스오버 해제
		if (speedChanged && hoveredBtn) {
			const mouseOutEvent = new MouseEvent('mouseout', { bubbles: true, cancelable: true });
			hoveredBtn.dispatchEvent(mouseOutEvent);
		}
	}

	// ===== (D) #test 주변 타겟 오버레이 숨김 =====
	const TEST_OVERLAY_REQUIRED_CLASSES = [
		'pointer-events-none',
		'absolute',
		'z-10',
		'w-full',
		'transition-opacity',
		'duration-0',
		'before:absolute',
		'before:bg-gradient-to-b'
	];

	function hasAllClasses(el, classNames) {
		return classNames.every(className => el.classList.contains(className));
	}

	function isTestOverlayTarget(el) {
		return el instanceof Element &&
			hasAllClasses(el, TEST_OVERLAY_REQUIRED_CLASSES) &&
			!el.classList.contains('transition-all') &&
			!Array.from(el.classList).some(className => className.startsWith('translate-y-'));
	}

	function findTestOverlayTarget() {
		const testEl = document.querySelector('#test');
		if (!testEl || !testEl.parentElement) return null;

		const siblings = Array.from(testEl.parentElement.children);
		const siblingsAfterTest = siblings.slice(siblings.indexOf(testEl) + 1);

		for (const sibling of siblingsAfterTest) {
			if (isTestOverlayTarget(sibling)) return sibling;

			const nestedTarget = Array.from(sibling.querySelectorAll('*'))
				.find(isTestOverlayTarget);
			if (nestedTarget) return nestedTarget;
		}

		return null;
	}

	function hideTestOverlayTarget() {
		const target = findTestOverlayTarget();
		if (!target) return false;

		target.dataset.tvingAutoSkipHiddenOverlay = 'true';
		target.style.setProperty('display', 'none', 'important');
		return true;
	}

	function installTestOverlayHider() {
		hideTestOverlayTarget();

		if (testSiblingObserver) return;

		testSiblingObserver = new MutationObserver(() => {
			hideTestOverlayTarget();
		});

		try {
			testSiblingObserver.observe(document.documentElement || document.body, {
				childList: true,
				subtree: true
			});
		} catch {}
	}

	// ===== 옵저버 라운드 =====
	function stopObserving() {
		if (mo) { try { mo.disconnect(); } catch {} mo = null; }
		if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
		if (observerKillTimer) { clearTimeout(observerKillTimer); observerKillTimer = null; }
	}

	function startObservingRound() {
		if (!config.autoSkipEnabled || !isPlayerPage()) return;

		stopObserving();

		const first = findSkipOpeningButton();
		if (first && clickOnce(first)) { stopObserving(); return; }

		mo = new MutationObserver(() => {
			const btn = findSkipOpeningButton();
			if (btn && clickOnce(btn)) stopObserving();
		});
		try {
			mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
		} catch {}

		scanTimer = setInterval(() => {
			const btn = findSkipOpeningButton();
			if (btn && clickOnce(btn)) stopObserving();
		}, SCAN_INTERVAL_MS);

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
			if (config.autoSkipEnabled && isPlayerPage()) startObservingRound();
			else stopObserving();
		}
	}

	// ===== 키 입력 처리 (기본 PageDown, ',' '.') =====
	function isEditable(el) {
		return (
			el &&
			(el.tagName === 'INPUT' ||
			 el.tagName === 'TEXTAREA' ||
			 el.isContentEditable)
		);
	}

	function installKeyHandler() {
		window.addEventListener('keydown', (e) => {
			try {
				if (isEditable(document.activeElement)) return;

				if (config.hotkeyCode && e.code === config.hotkeyCode) {
					e.preventDefault();
					e.stopPropagation();
					clickNextEpisode();
					return;
				}
				
				// 배속 조절
				handleSpeedKey(e);
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
				installTestOverlayHider();
			}

			if (config.autoSkipEnabled && isPlayerPage()) startObservingRound();
		});
	}

		chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== 'sync') return;

		let needsObserverRestart = false;
		for (let [key, { newValue }] of Object.entries(changes)) {
			if (key in config) {
				config[key] = newValue;
				if (key === 'autoSkipEnabled') {
					needsObserverRestart = true;
				}
			}
		}

		if (needsObserverRestart) {
			if (config.autoSkipEnabled && isPlayerPage()) startObservingRound();
			else stopObserving();
		}
	});

	loadConfigAndInit();
})();
