(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 700px)');
  const motionButton = document.querySelector('#motion-toggle');
  let paused = false;
  const motionAllowed = () => !paused && !reduced.matches;
  const work = window.STILL_WORK;
  const orbit = document.querySelector('#orbit');
  const stage = document.querySelector('#orbit-stage');
  const section = document.querySelector('#work');
  const dialog = document.querySelector('#project-dialog');
  const detail = document.querySelector('#project-detail');
  const projectButton = document.querySelector('#view-project');
  const status = document.querySelector('#work-status');
  const meta = p => p.venue.includes(p.date) ? p.venue : `${p.venue} · ${p.date}`;
  const mod = (n, base = work.length) => (n % base + base) % base;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const offsetAt = (index, position) => mod(index - position + 6, 12) - 6;
  const waveform = `<svg viewBox="0 0 300 70" aria-hidden="true"><g stroke="currentColor" fill="none" stroke-width="1.5">${Array.from({length:57}, (_,i) => {const h=5+Math.sin(i*.58)**2*Math.sin(i/57*Math.PI)*53; return `<path d="M${6+i*5} ${35-h/2}v${h}"/>`;}).join('')}</g></svg>`;
  function art(p) {
    let image = waveform, title = 'Talk2Agent', eyebrow = 'VOICE · INTENT · ACTION', foot = 'A benchmark for voice interfaces';
    if (p.art === 'crisis') {image = '<svg viewBox="0 0 180 90" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="52" cy="45" r="37"/><circle cx="88" cy="45" r="37"/><circle cx="124" cy="45" r="37"/></g></svg>';title='Listening<br>between<br>the words.';eyebrow='SPEECH & REASONING';foot='Crisis assessment';}
    if (p.art === 'duplex') {image='<svg viewBox="0 0 300 70" aria-hidden="true"><g fill="currentColor"><rect x="0" y="9" width="150" height="12"/><rect x="176" y="9" width="93" height="12"/><rect x="103" y="42" width="90" height="12"/><rect x="226" y="42" width="74" height="12"/></g></svg>';title='Your turn.<br>My turn.<br>Our turn.';eyebrow='FULL-DUPLEX DIALOGUE';foot='Speech · timing · interaction';}
    if (p.art === 'vision') {image='<svg viewBox="0 0 300 80" aria-hidden="true"><g fill="none" stroke="currentColor"><path d="M70 5L150 68L230 5M100 5L150 68L200 5M130 5L150 68L170 5M70 68h160"/></g><circle cx="150" cy="68" r="3" fill="currentColor"/></svg>';title='A different<br>light.';eyebrow='VISION & OPTIMIZATION';foot='Multi-source illumination';}
    return `<div class="card-art art-${p.art}"><span class="card-eyebrow">${eyebrow}</span>${image}<h4>${title}</h4><div class="card-foot"><span>${foot}</span><span>${p.date === '2026' ? '2026' : p.art === 'duplex' ? 'ByteDance' : '2023'}</span></div></div>`;
  }
  const cards = Array.from({length:12}, (_,i) => {
    const button = document.createElement('button'); button.type='button';button.className='orbit-card';button.dataset.slot=i;button.innerHTML=art(work[mod(i)]);button.setAttribute('aria-label', `View ${work[mod(i)].title}`);orbit.append(button);return button;
  });
  const state = {position:0,target:0,velocity:0};
  let frame=0,previous=0,current=-1,visible=true,drag=null,suppressUntil=0,returnFocus=null;
  function syncCopy() {
    const next=mod(Math.round(state.position));
    if (next===current) return;
    current=next;
    const p=work[current];
    document.querySelector('#project-meta').textContent=meta(p);
    document.querySelector('#project-title').textContent=p.title;
    document.querySelector('#project-summary').textContent=p.summary;
    document.querySelector('#work-count').textContent=String(current+1).padStart(2,'0');
    projectButton.setAttribute('aria-label',`View ${p.title}`);
  }
  function paint() {
    syncCopy();
    const slot=mod(Math.round(state.position),12), focused=document.activeElement;
    if (cards.includes(focused) && focused!==cards[slot] && !drag) cards[slot].focus({preventScroll:true});
    cards.forEach((card,i) => {
      const offset=offsetAt(i,state.position),distance=Math.abs(offset),active=i===slot;
      const x=-offset*(narrow.matches?45:74)-Math.sin(offset*.72)*10;
      const gap=narrow.matches?225:325;
      const y=offset*gap;
      const bend=clamp(state.velocity*.12,-.55,.55);
      card.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${(-offset*10+bend*Math.sin(offset)*2).toFixed(2)}deg) rotateY(${(offset*4).toFixed(2)}deg) scale(${(1-Math.min(distance,4)*.055).toFixed(4)})`;
      card.style.opacity=String(clamp((2.3-distance)/.4,0,1));
      card.style.zIndex=20-Math.round(distance*3);
      card.style.pointerEvents=distance<2.3?'auto':'none';
      card.classList.toggle('active',active);card.tabIndex=active?0:-1;card.setAttribute('aria-hidden',String(!active));
    });
  }
  function stop() {if(frame)cancelAnimationFrame(frame);frame=0;previous=0;}
  function settle() {stop();state.target=Math.round(state.target);state.position=state.target;state.velocity=0;paint();}
  function announce() {status.textContent=`${current+1} of ${work.length}. ${work[current].title}.`;}
  function tick(now) {
    frame=0;
    if (!motionAllowed()||!visible||document.hidden||dialog.open) {settle();return;}
    const dt=previous?clamp((now-previous)/1000,.001,.032):1/60;previous=now;
    state.velocity+=((state.target-state.position)*100-state.velocity*21)*dt;
    state.position+=state.velocity*dt;paint();
    if (Math.abs(state.target-state.position)>.0002||Math.abs(state.velocity)>.002) frame=requestAnimationFrame(tick);
    else {state.position=state.target;state.velocity=0;previous=0;paint();if(!drag)announce();}
  }
  function wake() {if(!motionAllowed()||!visible||document.hidden||dialog.open){settle();announce();return;}if(!frame)frame=requestAnimationFrame(tick);}
  function endGesture() {const old=drag;drag=null;if(old&&stage.hasPointerCapture(old.id))stage.releasePointerCapture(old.id);}
  function move(n) {endGesture();state.target=Math.round(state.target)+n;wake();}
  document.querySelector('#previous').addEventListener('click',()=>move(-1));
  document.querySelector('#next').addEventListener('click',()=>move(1));
  function motionPreference() {
    root.classList.toggle('motion-off',!motionAllowed());
    motionButton.disabled=reduced.matches;
    motionButton.setAttribute('aria-pressed',String(!motionAllowed()));
    motionButton.setAttribute('aria-label',reduced.matches?'Motion off: system preference':motionAllowed()?'Pause motion':'Resume motion');
    motionButton.innerHTML=motionAllowed()?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l8 6-8 6Z"/></svg>';
    if(!motionAllowed()){endGesture();settle();}
    dispatchEvent(new Event('motionchange'));
  }
  motionButton.addEventListener('click',()=>{paused=!paused;motionPreference();});
  reduced.addEventListener('change',motionPreference);
  orbit.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0||dialog.open)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,base:state.target,moving:false,touch:event.pointerType!=='mouse',axis:null};
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=drag.x-event.clientX,dy=drag.y-event.clientY;
    if(!drag.moving&&Math.max(Math.abs(dx),Math.abs(dy))>7){
      if(drag.touch&&Math.abs(dy)>Math.abs(dx)){endGesture();return;}
      drag.moving=true;drag.axis=drag.touch||Math.abs(dx)>Math.abs(dy)?'x':'y';stage.setPointerCapture(event.pointerId);
    }
    if(!drag?.moving)return;
    if(event.cancelable)event.preventDefault();
    state.target=drag.base+(drag.axis==='x'?dx/210:dy/280);
    if(motionAllowed())wake();else{state.position=state.target;paint();}
  });
  function release(event,cancelled=false){
    if(!drag||event.pointerId!==drag.id)return;
    const old=drag;endGesture();
    if(old.moving){suppressUntil=performance.now()+350;const delta=state.target-old.base;state.target=cancelled?Math.round(old.base):Math.round(state.target);if(!cancelled&&state.target===Math.round(old.base)&&Math.abs(delta)>.17)state.target+=Math.sign(delta);wake();}
  }
  stage.addEventListener('pointerup',event=>release(event));
  stage.addEventListener('pointercancel',event=>release(event,true));
  stage.addEventListener('lostpointercapture',event=>release(event,true));
  addEventListener('pointerup',event=>release(event));
  orbit.addEventListener('click',event=>{
    const card=event.target.closest('.orbit-card');if(!card||performance.now()<suppressUntil)return;
    const offset=offsetAt(Number(card.dataset.slot),Math.round(state.position));
    if(offset){endGesture();state.target=Math.round(state.position)+offset;wake();}else openProject();
  });
  orbit.addEventListener('keydown',event=>{
    if(event.altKey||event.metaKey||event.ctrlKey||event.shiftKey||dialog.open)return;
    const n=['ArrowDown','ArrowRight'].includes(event.key)?1:['ArrowUp','ArrowLeft'].includes(event.key)?-1:0;
    if(n){event.preventDefault();if(!event.repeat)move(n);}
    if(event.key==='Home'||event.key==='End'){event.preventDefault();move((event.key==='Home'?0:work.length-1)-mod(Math.round(state.target)));}
  });
  function openProject(){
    endGesture();state.target=Math.round(state.position);settle();returnFocus=document.activeElement;
    const p=work[current];
    detail.innerHTML=`<p class="detail-meta">${meta(p)}</p><h2 id="detail-title" class="detail-title">${p.fullTitle}</h2><p class="detail-authors">${p.authors}</p><p class="detail-description">${p.description}</p><div class="detail-tags">${p.tags.map(tag=>`<span>${tag}</span>`).join('')}</div>${p.url?`<a class="text-link" href="${p.url}" target="_blank" rel="noopener noreferrer">Read the paper <span>arXiv</span></a>`:''}`;
    dialog.showModal();
  }
  projectButton.addEventListener('click',openProject);
  document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  addEventListener('resize',()=>{endGesture();settle();});
  addEventListener('blur',()=>{endGesture();settle();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){endGesture();settle();}});
  if('IntersectionObserver'in window)new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible){endGesture();settle();}}).observe(section);
  paint();motionPreference();
})();
