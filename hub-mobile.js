'use strict';

(function setupDeviceAwareHub() {
  const params = new URLSearchParams(window.location.search);
  const forcedMobilePreview = params.get('device') === 'mobile';
  const reportedMobile = Boolean(navigator.userAgentData?.mobile);
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent);
  const compactTouchDevice = window.matchMedia('(max-width: 1024px)').matches
    && window.matchMedia('(pointer: coarse)').matches;
  const isMobileDevice = forcedMobilePreview || reportedMobile || mobileUserAgent || compactTouchDevice;

  if (!isMobileDevice) return;

  const cards = [...document.querySelectorAll('.game-card[data-mobile-support]')];
  const readyCards = cards.filter(card => card.dataset.mobileSupport === 'ready');
  const desktopCards = cards.filter(card => card.dataset.mobileSupport !== 'ready');
  const filter = document.getElementById('deviceFilter');
  const filterCount = document.getElementById('deviceFilterCount');
  const filterButtons = [...filter.querySelectorAll('[data-device-filter]')];
  const notice = document.getElementById('desktopGameNotice');
  const noticeTitle = document.getElementById('desktopGameTitle');
  const noticeReason = document.getElementById('desktopGameReason');
  const closeNoticeButton = document.getElementById('closeDesktopGameNotice');
  const openAnywayLink = document.getElementById('openDesktopGameAnyway');
  let lastFocusedCard = null;

  document.body.classList.add('mobile-device');
  filter.hidden = false;

  desktopCards.forEach(card => {
    card.classList.add('game-card--desktop-only');
    card.setAttribute('aria-label', `${card.getAttribute('aria-label') || 'Open game'} - desktop only`);

    const badges = card.querySelector('.card-badges');
    if (badges && !badges.querySelector('.badge--desktop')) {
      const badge = document.createElement('span');
      badge.className = 'badge badge--desktop';
      badge.textContent = 'Desktop only';
      badges.appendChild(badge);
    }

    const playButton = card.querySelector('.card-play-btn');
    if (playButton) playButton.textContent = 'Desktop only';

    card.addEventListener('click', event => {
      event.preventDefault();
      lastFocusedCard = card;
      const gameName = card.querySelector('.card-title')?.textContent.trim() || 'This game';
      const reason = card.dataset.desktopReason || 'It requires keyboard or mouse controls that are not designed for touch screens.';
      noticeTitle.textContent = `${gameName} needs a computer`;
      noticeReason.textContent = `${reason}. You can still open it, but it may not be playable on this device.`;
      openAnywayLink.href = card.href;
      notice.hidden = false;
      document.body.classList.add('device-notice-open');
      closeNoticeButton.focus();
    });
  });

  function setFilter(mode) {
    const showAll = mode === 'all';
    desktopCards.forEach(card => { card.hidden = !showAll; });
    filterButtons.forEach(button => {
      const active = button.dataset.deviceFilter === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    filterCount.textContent = showAll
      ? `${readyCards.length} mobile-ready / ${desktopCards.length} desktop-only`
      : `Showing ${readyCards.length} games made for touch`;
  }

  function closeNotice() {
    notice.hidden = true;
    document.body.classList.remove('device-notice-open');
    lastFocusedCard?.focus();
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.deviceFilter));
  });
  closeNoticeButton.addEventListener('click', closeNotice);
  notice.addEventListener('click', event => {
    if (event.target === notice) closeNotice();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !notice.hidden) closeNotice();
  });

  setFilter('mobile');
})();
