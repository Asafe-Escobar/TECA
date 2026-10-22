// Native playback stays usable when autoplay or third-party embeds are blocked.
(() => {
  const hero = document.querySelector('.teca-hero-video video');
  const heroButton = document.querySelector('.teca-hero-start');
  if (hero && heroButton) {
    const mobile = matchMedia('(max-width: 767px)');
    const selectSource = () => {
      const source = mobile.matches
        ? (hero.dataset.mobile || 'images/teca/hero-native-mobile.mp4')
        : (hero.dataset.desktop || 'images/teca/hero-clean-desktop.mp4');
      const url = new URL(source, document.baseURI).href;
      if (hero.src !== url) {
        hero.src = url;
        if (!hero.poster) hero.poster = 'images/teca/hero-clean-poster.jpg';
      }
      hero.muted = true;
      hero.defaultMuted = true;
      hero.playsInline = true;
    };
    let pending = false;
    const start = () => {
      if (!hero.paused || pending || document.hidden) return;
      pending = true;
      hero.muted = true;
      try {
        const result = hero.play();
        if (result && typeof result.then === 'function') {
          result.catch(() => { heroButton.hidden = false; })
            .finally(() => { pending = false; });
        } else {
          pending = false;
        }
      } catch (_) {
        pending = false;
        heroButton.hidden = false;
      }
    };
    hero.addEventListener('playing', () => { heroButton.hidden = true; });
    hero.addEventListener('error', () => { heroButton.hidden = false; });
    hero.addEventListener('canplay', start);
    heroButton.addEventListener('click', () => { pending = false; start(); });
    // These calls run in a real gesture, allowing playback on restrictive iPhones.
    const resumeInGesture = () => {
      const rect = hero.getBoundingClientRect();
      if (hero.paused && rect.bottom > 0 && rect.top < innerHeight) start();
    };
    document.addEventListener('touchend', resumeInGesture, {capture: true, passive: true});
    document.addEventListener('pointerup', resumeInGesture, {capture: true, passive: true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    window.addEventListener('pageshow', start);
    const update = () => { selectSource(); start(); };
    if (mobile.addEventListener) mobile.addEventListener('change', update);
    else if (mobile.addListener) mobile.addListener(update);
    selectSource();
    start();
  }

  document.querySelectorAll('.teca-vsl, .teca-turma').forEach(box => {
    const video = box.querySelector('video');
    const button = box.querySelector('.teca-media-play');
    if (!video || !button) return;
    video.playsInline = true;
    video.controls = true;
    button.hidden = !video.paused;
    video.addEventListener('playing', () => { button.hidden = true; });
    video.addEventListener('pause', () => { button.hidden = false; });
    video.addEventListener('ended', () => { button.hidden = false; });
    video.addEventListener('error', () => {
      button.hidden = false;
      button.querySelector('span').textContent = 'Tentar reproduzir novamente';
    });
    button.addEventListener('click', () => {
      if (video.error) video.load();
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => { button.hidden = false; });
      }
    });
  });
  document.documentElement.dataset.tecaMedia = 'ready';
})();
