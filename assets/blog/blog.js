const progress = document.querySelector('.reading-progress span');
const article = document.querySelector('.post-body');
let framePending = false;
function updateProgress() {
  const start = article.offsetTop;
  const end = start + article.offsetHeight - window.innerHeight;
  const fraction = Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, end - start)));
  progress.style.transform = `scaleX(${fraction})`;
  framePending = false;
}
window.addEventListener('scroll', () => {
  if (!framePending) { framePending = true; requestAnimationFrame(updateProgress); }
}, { passive:true });
window.addEventListener('resize', updateProgress);
window.addEventListener('load', updateProgress);
const links = [...document.querySelectorAll('.toc nav a')];
const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
  if (visible.length) links.forEach(link => link.classList.toggle('active', link.hash === `#${visible[0].target.id}`));
}, { rootMargin:'-5% 0px -68% 0px' });
sections.forEach(section => observer.observe(section));
document.querySelectorAll('.mobile-toc a').forEach(link => link.addEventListener('click', () => {
  document.querySelector('.mobile-toc').open = false;
}));

const stepper = document.querySelector('.figure-steps');
if (stepper) {
  const tabs = [...stepper.querySelectorAll('[role="tab"]')];
  const descriptions = [
    '先看一个给定位置的变化, 如何影响当前位置及后续位置。',
    '再累加目标位置的影响, 对源位置和 prompt 依次求平均。'
  ];
  let currentStep = 0;
  function selectStep(index, focus = false) {
    currentStep = (index + tabs.length) % tabs.length;
    tabs.forEach((tab,i) => {
      tab.setAttribute('aria-selected', String(i === currentStep));
      tab.tabIndex = i === currentStep ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = i !== currentStep;
    });
    stepper.querySelector('.step-description').textContent = descriptions[currentStep];
    stepper.querySelector('.step-next').innerHTML = currentStep ? '回到第一步 <span aria-hidden="true">↶</span>' : '下一步 <span aria-hidden="true">→</span>';
    if (focus) tabs[currentStep].focus({ preventScroll:true });
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click', () => selectStep(index));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = currentStep + 1;
      if (event.key === 'ArrowLeft') target = currentStep - 1;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) { event.preventDefault(); selectStep(target,true); }
    });
  });
  stepper.querySelector('.step-next').addEventListener('click', () => selectStep(currentStep + 1));
  function showLinkedStep(hash) {
    const index = tabs.findIndex(tab => '#' + tab.getAttribute('aria-controls') === hash);
    if (index < 0) return;
    selectStep(index, true);
    stepper.scrollIntoView({ block:'start' });
  }
  document.querySelectorAll('a[href="#jacobian-panel-1"], a[href="#jacobian-panel-2"]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      showLinkedStep(link.hash);
    });
  });
  window.addEventListener('hashchange', () => showLinkedStep(location.hash));
  showLinkedStep(location.hash);
}

document.querySelectorAll('.source-experiment').forEach(exhibit => {
  const windowElement = exhibit.querySelector('.source-window');
  const nativeHeight = Number(windowElement.dataset.height);
  function resizeSource() {
    const scale = Math.min(1, windowElement.clientWidth / 1280);
    windowElement.style.setProperty('--source-scale', scale);
    windowElement.style.setProperty('--scaled-height', `${Math.ceil(nativeHeight * scale)}px`);
  }
  new ResizeObserver(resizeSource).observe(windowElement);
  resizeSource();
  const dialog = exhibit.querySelector('.source-dialog');
  const openButton = exhibit.querySelector('.source-open');
  const modalFrame = dialog.querySelector('iframe');
  openButton.addEventListener('click', () => {
    // Load the authors' original page on first expansion; retain its state on close.
    if (!modalFrame.hasAttribute('src')) modalFrame.src = modalFrame.dataset.src;
    dialog.showModal();
    document.body.classList.add('source-dialog-open');
  });
  dialog.querySelector('.source-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('source-dialog-open');
    openButton.focus({ preventScroll:true });
  });
});
