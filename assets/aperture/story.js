(() => {
  'use strict';
  const story = document.querySelector('#portrait-story');
  const about = document.querySelector('#about');
  const stage = document.querySelector('#portrait-stage');
  const reveal = document.querySelector('.reveal-control');
  if (!story || !about || !stage) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  function updateHint(progress, instant) {
    if (!reveal) return;
    const state = stage.dataset.gatherState;
    reveal.hidden = progress < .98 || instant || !stage.classList.contains('ripple-ready') || state === 'revealing' || state === 'photo';
  }
  function paint() {
    frame = 0;
    const bounds = story.getBoundingClientRect();
    const distance = about.getBoundingClientRect().top - bounds.top;
    const position = distance > 0 ? -bounds.top / distance : 0;
    const t = Math.max(0, Math.min(1, (position - .02) / .94));
    const progress = t * t * (3 - 2 * t);
    const instant = reduced.matches || document.documentElement.classList.contains('motion-off');
    const active = bounds.bottom > 0 && bounds.top < innerHeight;
    story.dataset.gatherProgress = progress.toFixed(5);
    updateHint(progress, instant);
    dispatchEvent(new CustomEvent('portraitgather', {detail:{progress,active,instant}}));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
  reveal?.addEventListener('click', () => dispatchEvent(new CustomEvent('portraitreveal')));
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  addEventListener('pageshow', schedule);
  addEventListener('hashchange', schedule);
  addEventListener('motionchange', schedule);
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  new MutationObserver(() => {
    updateHint(Number(story.dataset.gatherProgress || 0), reduced.matches || document.documentElement.classList.contains('motion-off'));
  }).observe(stage,{attributes:true,attributeFilter:['class','data-gather-state']});
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(story);
  paint();
})();
