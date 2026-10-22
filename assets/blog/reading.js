import {voiceIcon} from './voice-icons-v1.js';
const panel = document.querySelector('.article-listener');
const dock = document.querySelector('.listener-dock');
const viewport = document.querySelector('.page-scroll');
const controlSets=[panel,dock];
const controls=selector=>controlSets.flatMap(root=>[...root.querySelectorAll(selector)]);
const lang = panel.dataset.language;
const en = lang === 'en';
const labels = en ? {play:'Play',pause:'Pause',loading:'Loading narration…',ready:'Click a word to listen from there.',error:'Audio could not be loaded. Please try again.',finish:'End of article.',collapse:'Collapse player',expand:'Expand player'} : {play:'播放',pause:'暂停',loading:'正在载入朗读…',ready:'点击正文中的词，可以从那里开始听。',error:'音频载入失败，请重试。',finish:'全文朗读结束。',collapse:'收起朗读窗口',expand:'展开朗读窗口'};
const normal = text => [...text.normalize('NFKC').toLowerCase()].filter(c=>/[\p{L}\p{N}]/u.test(c));
const segmenter = new Intl.Segmenter(en?'en':'zh',{granularity:'word'});
function wordParts(text) {
  const terms=/(?:J[- ]?(?:Lens|Space)|hidden state|全局工作空间)/gi;
  const parts=[];
  let cursor=0;
  for(const match of text.matchAll(terms)) {
    parts.push(...segmenter.segment(text.slice(cursor,match.index)));
    parts.push({segment:match[0],isWordLike:true});
    cursor=match.index+match[0].length;
  }
  parts.push(...segmenter.segment(text.slice(cursor)));
  return parts;
}
const clock = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const status = panel.querySelector('.listener-status');
const play = panel.querySelector('.listener-play');
const plays = controls('.listener-play');
const seek = panel.querySelector('.listener-seek');
const voice = panel.querySelector('.listener-voice');
const speed = panel.querySelector('.listener-speed');
const follow = panel.querySelector('.listener-follow');
const speeds=controls('.listener-speed');
const follows=controls('.listener-follow');
const playSVG='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor"/></svg>';
const pauseSVG='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/></svg>';
const open = document.querySelector('.listen-open');
const blocks = [...document.querySelectorAll('[data-narratable]')];
const targets = [];
let manifest, chunkIndex=0, audio=null, active=null, animation=0, loadVersion=0, loading=null;
let warmed=null, resumeOnReady=false;

// Wrap only manuscript text, leaving KaTeX, links and the official exhibits intact.
for (const block of blocks) {
  const id=block.dataset.readingId;
  const maths=[...block.querySelectorAll('.katex')];
  maths.forEach((math,index)=>{
    math.classList.add('reading-formula');
    math.dataset.readingFormula=String(index);
    targets.push({block:id,formula:index,element:math});
  });
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement.closest('.katex')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  let offset=0;
  for(const node of nodes) {
    const fragment=document.createDocumentFragment();
    for(const part of wordParts(node.textContent)) {
      const size=normal(part.segment).length;
      if(!part.isWordLike || !size) fragment.append(document.createTextNode(part.segment));
      else {
        const word=document.createElement('span');
        word.className='reading-word';
        word.textContent=part.segment;
        targets.push({block:id,from:offset,to:offset+size,element:word});
        fragment.append(word);
      }
      offset+=size;
    }
    node.replaceWith(fragment);
  }
}

function highlight(target) {
  if(active===target) return;
  active?.element.classList.remove('reading-active');
  active=target;
  active?.element.classList.add('reading-active');
  if(active && follow.checked) {
    const box=active.element.getBoundingClientRect();
    const visible=viewport.getBoundingClientRect();
    if(box.top<visible.top+80 || box.bottom>visible.bottom-60) active.element.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
}

function currentGlobal() { return (manifest?.chunks[chunkIndex]?.offset||0)+(audio?.currentTime||0); }
function update() {
  if(!manifest || !audio) return;
  const time=audio.currentTime;
  const cues=manifest.chunks[chunkIndex].targets;
  let target;
  for(const cue of cues) {
    if(cue.start<=time) target=cue.target;
    else break;
  }
  if(target) highlight(target);
  seek.value=String(currentGlobal());
  seek.style.setProperty('--seek-progress',`${100*currentGlobal()/manifest.duration}%`);
  controls('.listener-clock').forEach(node=>node.textContent=`${clock(currentGlobal())} / ${clock(manifest.duration)}`);
  showPlayState(!audio.paused);
}
function showPlayState(playing) {
  for(const button of plays) {
    const state=playing?'pause':'play';
    if(button.dataset.state!==state){button.innerHTML=playing?pauseSVG:playSVG;button.dataset.state=state;}
    button.setAttribute('aria-label',playing?labels.pause:labels.play);
    button.title=playing?labels.pause:labels.play;
  }
  document.body.classList.toggle('reader-playing',playing);
}
function tick() { update(); if(audio && !audio.paused) animation=requestAnimationFrame(tick); }

async function start() {
  if(panel.hidden)return;
  if(!manifest) { resumeOnReady=true; await ensureLoaded(); return; }
  if(audio?.ended && chunkIndex===manifest.chunks.length-1){setChunk(0);highlight(null);}
  if(!audio) setChunk(0);
  try { await audio.play(); status.textContent=labels.ready; }
  catch { status.textContent=labels.error; showPlayState(false); }
}
function setChunk(index,time=0) {
  audio?.pause();
  cancelAnimationFrame(animation);
  chunkIndex=Math.min(manifest.chunks.length-1,Math.max(0,index));
  const chunk=manifest.chunks[chunkIndex];
  audio=warmed?.src===new URL(chunk.audio,location.origin).href?warmed:new Audio(chunk.audio);
  warmed=null;
  audio.preload='auto';
  audio.playbackRate=Number(speed.value);
  audio.currentTime=Math.min(time,Math.max(0,chunk.duration-.03));
  const thisAudio=audio;
  audio.addEventListener('play',()=>{if(audio!==thisAudio)return;cancelAnimationFrame(animation);tick();});
  for(const event of ['pause','seeked','loadedmetadata','timeupdate']) audio.addEventListener(event,()=>{if(audio===thisAudio)update();});
  audio.addEventListener('error',()=>{if(audio===thisAudio)status.textContent=labels.error;});
  audio.addEventListener('ended',()=>{
    if(audio!==thisAudio) return;
    if(chunkIndex+1<manifest.chunks.length) {setChunk(chunkIndex+1);start();}
    else { update();status.textContent=labels.finish;showPlayState(false); }
  });
  if(manifest.chunks[chunkIndex+1]) {warmed=new Audio(manifest.chunks[chunkIndex+1].audio);warmed.preload='auto';}
  update();
}

function bindTimings(data) {
  const byBlock=new Map();
  for(const target of targets) {
    target.cue=undefined;
    if(!byBlock.has(target.block))byBlock.set(target.block,[]);
    byBlock.get(target.block).push(target);
  }
  let offset=0;
  data.chunks.forEach((chunk,index)=>{
    chunk.offset=offset;
    offset+=chunk.duration;
    const hits=new Map();
    for(const [blockId,at,start,end] of chunk.alignment) {
      const target=byBlock.get(blockId)?.find(t=>at<0?t.formula===-at-1:t.formula===undefined && t.from<=at && t.to>at);
      if(!target) continue;
      if(!hits.has(target))hits.set(target,{target,start,end});
      else {const hit=hits.get(target);hit.start=Math.min(hit.start,start);hit.end=Math.max(hit.end,end);}
    }
    chunk.targets=[...hits.values()].sort((a,b)=>a.start-b.start);
    for(const cue of chunk.targets) if(!cue.target.cue)cue.target.cue={index,start:cue.start,end:cue.end,globalStart:chunk.offset+cue.start};
  });
  data.duration=offset;
  return data;
}

async function loadVoice() {
  const version=++loadVersion;
  const wasPlaying=!!audio && !audio.paused;
  resumeOnReady=resumeOnReady || wasPlaying;
  const previous=active;
  audio?.pause();audio=null;
  manifest=null;
  status.textContent=labels.loading;
  plays.forEach(button=>button.disabled=true);
  try {
    const response=await fetch(`/assets/blog/anthropic-j-space/narration/manifest-${lang}-${voice.value}.json?v=${panel.dataset.version}`,{cache:'no-cache'});
    if(!response.ok)throw new Error('Manifest unavailable');
    const data=await response.json();
    if(version!==loadVersion)return;
    if(data.language!==lang || !data.complete || data.revision!==panel.dataset.readingRevision)throw new Error('Narration unavailable or outdated');
    manifest=bindTimings(data);
    seek.max=manifest.duration;
    setChunk(previous?.cue?.index||0,previous?.cue?.start||0);
    status.textContent=labels.ready;
    plays.forEach(button=>button.disabled=false);
    if(resumeOnReady){resumeOnReady=false;await start();}
  } catch {if(version===loadVersion){manifest=null;status.textContent=labels.error;plays.forEach(button=>button.disabled=false);}}
}
function requestVoice() {const pending=loadVoice();loading=pending;pending.finally(()=>{if(loading===pending)loading=null;});return pending;}
function ensureLoaded(){ if(loading)return loading;if(manifest)return Promise.resolve();return requestVoice(); }
function show() {panel.hidden=false;open.setAttribute('aria-expanded','true');document.body.classList.add('listener-visible');panel.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});updateDock();return ensureLoaded();}
open.addEventListener('click',()=>{show();});
plays.forEach(button=>button.addEventListener('click',async()=>{await ensureLoaded(); if(audio && !audio.paused)audio.pause();else start();}));
const iconVariant=new URLSearchParams(location.search).get('voice-icons')==='organic'?'organic':'rounded';
voice.innerHTML=voiceIcon('male',iconVariant);
voice.addEventListener('click',()=>{
  voice.value=voice.value==='liufei'?'xiaohe':'liufei';
  const male=voice.value==='liufei';
  voice.innerHTML=voiceIcon(male?'male':'female',iconVariant);
  voice.setAttribute('aria-label',male?'male':'female');
  voice.title=male?'male → female':'female → male';
  requestVoice();
});
const rates=[.85,1,1.15,1.3,1.5,2];
speeds.forEach(button=>button.addEventListener('click',()=>{
  const rate=rates[(rates.indexOf(Number(button.value))+1)%rates.length];
  speeds.forEach(other=>{other.value=String(rate);other.textContent=`${rate}×`;other.setAttribute('aria-label',`${en?'Speed':'速度'} ${rate}×`);});
  if(audio)audio.playbackRate=rate;
}));
follows.forEach(input=>input.addEventListener('change',()=>follows.forEach(other=>other.checked=input.checked)));
function seekTo(global) {
  if(!manifest)return;
  global=Math.max(0,Math.min(manifest.duration-.03,global));
  const index=Math.max(0,manifest.chunks.findLastIndex(c=>c.offset<=global));
  const playing=audio && !audio.paused;
  if(index!==chunkIndex)setChunk(index,global-manifest.chunks[index].offset);
  else {audio.currentTime=global-manifest.chunks[index].offset;update();}
  if(global===0)highlight(null);
  if(playing)start();
}
seek.addEventListener('input',()=>seekTo(Number(seek.value)));
async function skip(seconds) {await ensureLoaded();seekTo(currentGlobal()+seconds);}
controls('.listener-previous').forEach(button=>button.addEventListener('click',()=>skip(-15)));
controls('.listener-next').forEach(button=>button.addEventListener('click',()=>skip(15)));
dock.querySelector('.listener-collapse').addEventListener('click',event=>{
  const collapsed=dock.classList.toggle('collapsed');
  event.currentTarget.textContent=collapsed?'+':'−';
  event.currentTarget.setAttribute('aria-expanded',String(!collapsed));
  event.currentTarget.setAttribute('aria-label',collapsed?labels.expand:labels.collapse);
  positionDock();
});
controls('.listener-close').forEach(button=>button.addEventListener('click',()=>{
  resumeOnReady=false;audio?.pause();panel.hidden=true;open.setAttribute('aria-expanded','false');document.body.classList.remove('listener-visible');updateDock();open.focus({preventScroll:true});
}));
document.querySelector('.post-body').addEventListener('click',async event=>{
  if(event.target.closest('a') || panel.hidden)return;
  const element=event.target.closest('.reading-word,.reading-formula');
  if(!element || getSelection()?.toString())return;
  await ensureLoaded();
  const target=targets.find(t=>t.element===element);
  if(target?.cue){setChunk(target.cue.index,target.cue.start);highlight(target);await start();}
});
document.addEventListener('keydown',event=>{
  if(event.code==='Space' && !panel.hidden && !event.target.closest('input,select,button,a,textarea') && !event.metaKey && !event.ctrlKey){event.preventDefault();play.click();}
});
// Loading is user initiated, avoiding an audio download for ordinary readers.

let dockVisible=false, hideTimer;
function positionDock() {
  if(dock.hidden)return;
  const articleEdge=document.querySelector('.post-body').getBoundingClientRect().right;
  const free=innerWidth-articleEdge;
  const narrow=free<210 || innerWidth<=950;
  dock.classList.toggle('narrow',narrow);
  if(narrow){dock.style.width='';dock.style.right='';}
  else {const width=Math.min(220,free-35);dock.style.width=`${width}px`;dock.style.right=`${Math.max(16,(free-width)/2)}px`;}
  const height=dock.getBoundingClientRect().height;
  document.body.style.setProperty('--reader-shelf-height',`${Math.ceil(height)+24}px`);
  document.body.style.setProperty('--reader-side-reserve',`${Math.ceil(height)+30}px`);
  document.body.classList.toggle('listener-shelf',narrow && dockVisible);
  document.body.classList.toggle('listener-side',!narrow && dockVisible);
}
function updateDock() {
  const above=seek.getBoundingClientRect().bottom<=viewport.getBoundingClientRect().top+1;
  const visible=!panel.hidden && above;
  if(visible===dockVisible){if(visible)positionDock();return;}
  dockVisible=visible;
  panel.inert=visible;
  clearTimeout(hideTimer);
  if(visible){
    dock.hidden=false;dock.inert=false;positionDock();
    requestAnimationFrame(()=>{if(dockVisible)dock.classList.add('is-visible');});
  }else{
    dock.classList.remove('is-visible');dock.inert=true;
    const finish=()=>{if(!dockVisible){dock.hidden=true;document.body.classList.remove('listener-shelf','listener-side');}};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else hideTimer=setTimeout(finish,300);
  }
}
const dockObserver=new IntersectionObserver(updateDock,{root:viewport});
dockObserver.observe(seek);
new ResizeObserver(()=>{if(dockVisible)positionDock();}).observe(dock);
let dockFrame=0;
viewport.addEventListener('scroll',()=>{if(!dockFrame)dockFrame=requestAnimationFrame(()=>{dockFrame=0;updateDock();});},{passive:true});
window.addEventListener('resize',updateDock);

function alignInline() {
  const article=document.querySelector('.post-body').getBoundingClientRect();
  const header=document.querySelector('.post-header').getBoundingClientRect();
  panel.style.width=`${article.width}px`;
  panel.style.marginLeft=`${article.left-header.left}px`;
}
new ResizeObserver(alignInline).observe(document.querySelector('.post-body'));
alignInline();
