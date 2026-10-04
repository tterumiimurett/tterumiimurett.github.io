const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.getElementById('motion-toggle');
let motionEnabled = !motionPreference.matches;
function updateMotion() {
  document.documentElement.classList.toggle('motion-off', !motionEnabled);
  motionButton.textContent = motionEnabled ? '[ MOTION ON ]' : '[ MOTION OFF ]';
  motionButton.setAttribute('aria-pressed', String(!motionEnabled));
  motionButton.setAttribute('aria-label', motionEnabled ? 'Pause animations' : 'Enable animations');
}
motionButton.addEventListener('click', () => { motionEnabled = !motionEnabled; updateMotion(); });
motionPreference.addEventListener('change', () => { motionEnabled = !motionPreference.matches; updateMotion(); });
updateMotion();
const hero = document.querySelector('.hero');
hero.addEventListener('pointermove', (event) => {
  if (!motionEnabled || event.pointerType !== 'mouse') return;
  const bounds = hero.getBoundingClientRect();
  hero.style.setProperty('--move-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 18}px`);
  hero.style.setProperty('--move-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 10}px`);
});
hero.addEventListener('pointerleave', () => { hero.style.setProperty('--move-x', '0px'); hero.style.setProperty('--move-y', '0px'); });
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); observer.unobserve(entry.target); }
    }
  }, { threshold: .08 });
  for (const target of document.querySelectorAll('.section-top, .about-main, .paper, .background-entry, .life>div')) {
    target.classList.add('reveal');
    if (motionEnabled && target.getBoundingClientRect().top > innerHeight) target.classList.add('reveal-pending');
    observer.observe(target);
  }
}
function updateClock() {
  document.getElementById('beijing-time').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) + ' CST';
}
updateClock();
setInterval(updateClock, 60000);
document.getElementById('paper-count').textContent = String(window.siteContent.papers.filter((paper) => paper.published).length).padStart(2, '0');
