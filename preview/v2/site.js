const content = window.siteContent;
const byId = (id) => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function render() {
  byId('name').textContent = content.name;
  byId('footer-name').textContent = content.name;
  document.querySelector('.brand').lastChild.textContent = ` ${content.name.toUpperCase()}`;
  byId('paper-count').textContent = String(content.papers.filter((paper) => paper.published).length).padStart(2, '0');
  byId('headline').textContent = content.headline;
  byId('bio').textContent = content.bio;
  byId('personal').textContent = content.personal || '';
  for (const section of ['education', 'experience']) {
    byId(section).replaceChildren(...(content[section] || []).map((entry) => {
      const article = element('article', 'background-entry');
      article.append(element('p', 'entry-period', entry.period), element('h4', '', entry.organization), element('p', 'entry-role', entry.role));
      if (entry.description) article.append(element('p', 'entry-description', entry.description));
      return article;
    }));
  }
  byId('year').textContent = new Date().getFullYear();
  document.title = `${content.name} · Research & Notes`;
  byId('interests').replaceChildren(...content.interests.map((interest) => element('span', '', interest)));
  byId('contact').hidden = !content.email;
  byId('contact').href = `mailto:${content.email}`;
  const portrait = byId('portrait');
  portrait.hidden = !content.portrait;
  document.querySelector('.portrait-art').hidden = Boolean(content.portrait);
  if (content.portrait) { portrait.src = safeUrl(content.portrait); portrait.alt = content.name; }
  portrait.onerror = () => { portrait.hidden = true; document.querySelector('.portrait-art').hidden = false; };
  byId('papers').replaceChildren(...content.papers.filter((paper) => paper.published).map((paper, index) => {
    const article = element('article', 'paper');
    const art = element('div', 'paper-art');
    art.setAttribute('aria-hidden', 'true');
    art.append(element('span', 'symbol', index === 0 ? '))) →' : '∿ + ∿'), element('span', 'topic', paper.topic));
    const copy = element('div', 'paper-copy');
    copy.append(element('p', 'paper-meta', [paper.year, paper.type].filter(Boolean).join(' / ')), element('h3', '', paper.title), element('p', 'authors', paper.authors), element('p', 'paper-summary', paper.summary));
    const bottom = element('div', 'paper-bottom');
    const tags = element('div', 'tags');
    tags.append(...paper.tags.map((tag) => element('span', 'tag', tag)));
    bottom.append(tags);
    if (paper.url && safeUrl(paper.url)) { const link = element('a', 'paper-link', 'Read paper ↗'); link.href = safeUrl(paper.url); bottom.append(link); }
    copy.append(bottom); article.append(art, copy); return article;
  }));
  const posts = content.posts.filter((post) => post.published);
  byId('posts').replaceChildren();
  if (!posts.length) {
    const empty = element('div', 'empty-notes');
    const copy = element('div');
    copy.append(element('h3', '', 'The notebook is open.'), element('p', '', 'Notes and essays will find their home here.'));
    empty.append(element('span', 'asterisk', '✳'), copy); byId('posts').append(empty);
  }
  for (const post of posts) {
    const details = element('details', 'post');
    const summary = element('summary');
    summary.append(element('span', '', post.date), element('strong', '', post.title), element('span', '', `${post.category} +`));
    const body = element('div', 'post-body');
    body.append(...post.body.split(/\n\s*\n/).map((paragraph) => element('p', '', paragraph)));
    details.append(summary, body); byId('posts').append(details);
  }
}
render();
const editing = new URLSearchParams(location.search).get('edit') === '1';
byId('edit-button').hidden = !editing;
const form = byId('edit-form');
function applyForm() {
  for (const field of ['name', 'headline', 'bio', 'email', 'portrait']) content[field] = form.elements[field].value.trim();
  content.interests = form.elements.interests.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean);
  const upcoming = content.papers.find((paper) => paper.title === 'proactive FD-benchmark');
  if (upcoming) upcoming.published = form.elements.showUpcoming.checked;
  render();
}
byId('edit-button').addEventListener('click', () => {
  for (const field of ['name', 'headline', 'bio', 'email', 'portrait']) form.elements[field].value = content[field];
  form.elements.interests.value = content.interests.join(', ');
  form.elements.showUpcoming.checked = Boolean(content.papers.find((paper) => paper.title === 'proactive FD-benchmark')?.published);
  byId('editor').showModal();
});
byId('close-editor').addEventListener('click', () => byId('editor').close());
form.addEventListener('submit', (event) => { event.preventDefault(); applyForm(); byId('editor').close(); });
byId('download').addEventListener('click', () => {
  if (!form.reportValidity()) return;
  applyForm();
  const blob = new Blob([`window.siteContent = ${JSON.stringify(content, null, 2)};\n`], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = element('a'); link.href = url; link.download = 'content.js'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  byId('edit-status').textContent = '已下载。用它替换网站目录中的 content.js 即可保存内容。';
});
