(() => {
  'use strict';
  // Color in Motion's local wave, transport, and inertia are retained from Still V3.
  // Moving particle apertures reveal a fixed photographic plane at their current pixels.
  const stage = document.getElementById('portrait-stage');
  const portrait = document.getElementById('portrait');
  const surface = document.querySelector('.particle-surface.hero');
  const story = document.getElementById('portrait-story');
  const target = document.querySelector('.portrait-target');
  if (!stage || !portrait || !surface || !story || !target || stage.querySelector('canvas[data-paper-portrait]')) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  function staticPhoto(reason = 'static') {
    target.style.setProperty('--photo-opacity', '1');
    target.style.setProperty('--reveal-radius', '10000px');
    target.style.setProperty('--reveal-softness', '1px');
    target.style.setProperty('--reveal-x', '50%');
    target.style.setProperty('--reveal-y', '50%');
    stage.dataset.gatherState = 'photo';
    stage.dataset.revealProgress = '1.0000';
    stage.dataset.renderer = reason;
  }
  const canvas = document.createElement('canvas');
  canvas.dataset.paperPortrait = '';
  canvas.setAttribute('aria-hidden', 'true');
  stage.insertBefore(canvas, stage.querySelector('.portrait-fade'));
  const graphics = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!graphics) { canvas.remove(); staticPhoto('fallback'); return; }

  const vertexSource = `
    attribute vec2 position;
    attribute float seed;
    uniform vec2 resolution;
    uniform vec4 compact;
    uniform float sourceScale;
    uniform float gather;
    uniform float clock;
    uniform float pixelRatio;
    uniform float spacing;
    uniform vec2 cursor;
    uniform float energy;
    uniform float presence;
    uniform vec2 velocity;
    uniform vec2 revealOrigin;
    uniform float revealRadius;
    uniform float revealSoftness;
    uniform float revealing;
    varying float visibility;
    varying mediump vec2 photoUV;
    varying mediump float baseDiameter;
    varying mediump float sizeFactor;
    varying mediump float spriteDiameter;
    void main() {
      vec2 uv = position;
      vec2 anchorUV = vec2(0.60, 0.48);
      vec2 anchor = compact.xy + compact.zw * anchorUV;
      // The particles keep Gather's inward trajectories, including its wave.
      // Their colours are sampled from where they travel on a fixed image plane.
      vec2 local = (uv - anchorUV) * compact.zw;
      float periphery = clamp(length((uv - anchorUV) / vec2(0.65, 0.60)), 0.0, 1.0);
      float delay = (1.0 - periphery) * 0.12;
      float progress = smoothstep(delay, 1.0, gather);
      vec2 point = anchor + local * mix(sourceScale, 1.0, progress);
      float gatherWave = sin(length(local) * 0.020 - gather * 9.0);
      vec2 inward = -local / max(length(local), 1.0);
      vec2 tangent = vec2(-inward.y, inward.x);
      float gathering = sin(gather * 3.14159265);
      point += (inward * gatherWave * 10.0 + tangent * sin(periphery * 4.0 + gather * 3.0) * 13.0)
        * gathering * periphery;
      // These kinetics are the approved V3 / Color in Motion implementation.
      float scale = spacing / 8.0;
      vec2 delta = point - cursor;
      float distance = length(delta);
      vec2 outward = delta / max(distance, 1.0);
      float radius = (190.0 + energy * 140.0) * scale;
      float influence = (1.0 - smoothstep(radius * 0.05, radius, distance)) * presence;
      float speed = length(velocity) * 0.0015;
      vec2 direction = velocity / max(length(velocity), 0.001);
      vec2 across = vec2(-direction.y, direction.x);
      float side = clamp(dot(outward, across), -1.0, 1.0);
      vec2 transport = direction * 1.15 + across * side * 0.85;
      float travel = min(speed, 1.4) * (26.0 + seed * 10.0) * scale;
      float crest = sin(distance / scale * 0.05 - clock * 8.0);
      vec2 displacement = transport * influence * travel;
      displacement += outward * influence * crest * (0.25 + energy * 0.75) * 7.0 * scale;
      float highlight = 0.2 + min(speed, 1.2) * 0.55 + (crest * 0.5 + 0.5) * 0.25;
      float glow = clamp(influence * highlight * (0.35 + energy * 0.65), 0.0, 1.0);
      vec2 idleOffset = point - anchor;
      float idleDistance = length(idleOffset);
      float idleWave = sin(idleDistance * 0.033 - clock * 1.1);
      float idleSecondary = sin(point.y * 0.024 + point.x * 0.012 - clock * 0.8);
      displacement += idleOffset / max(idleDistance, 1.0) * idleWave * 1.4 + vec2(0.4, 0.7) * idleSecondary * 0.65;

      vec2 revealDelta = point - revealOrigin;
      float revealDistance = length(revealDelta);
      float front = exp(-pow((revealDistance - revealRadius) / max(revealSoftness * 0.64, 1.0), 2.0)) * revealing;
      displacement += revealDelta / max(revealDistance, 1.0) * front * 6.0;
      // Sample dot size at its final centre, including every pointer/idle ripple.
      // Actual visible colour is sampled per screen pixel in the fragment shader.
      photoUV = anchorUV + (point + displacement - anchor) / (compact.zw * sourceScale);
      vec2 screen = (point + displacement) / resolution;
      gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);

      // The same visible particles gather instead of being removed by a shrinking mask.
      vec2 oval = (uv - vec2(0.57, 0.50)) / vec2(0.59, 0.66);
      float contour = length(oval) + sin(uv.y * 15.0 + uv.x * 6.0) * 0.028
        + sin(uv.x * 19.0 - uv.y * 4.0) * 0.017;
      float feather = 1.0 - smoothstep(0.42, 1.06, contour);
      feather *= smoothstep(0.0, 0.25, uv.x) * (1.0 - smoothstep(0.82, 1.0, uv.x));
      feather *= smoothstep(0.0, 0.19, uv.y) * (1.0 - smoothstep(0.77, 1.0, uv.y));
      float scattered = smoothstep(seed * 0.36, seed * 0.36 + 0.12, feather);
      float covered = (1.0 - smoothstep(revealRadius - revealSoftness, revealRadius, revealDistance)) * revealing;
      visibility = feather * scattered * (1.0 - covered);
      float grain = pow(seed, 1.5);
      float breathing = idleWave * 0.65 + idleSecondary * 0.35;
      baseDiameter = 1.50 + grain * 3.45 + glow * 1.30 + breathing * 0.36;
      sizeFactor = spacing / 5.5;
      sizeFactor *= mix(0.32, 1.0, smoothstep(0.02, 0.78, feather));
      sizeFactor *= mix(1.14, 1.0, progress) + front * 0.72;
      // Reserve the maximum dark-dot quad. Its exact diameter is determined
      // from the current sampled colour in the fragment shader (WebGL1-safe).
      spriteDiameter = max(0.65, (baseDiameter + 1.65) * sizeFactor);
      gl_PointSize = spriteDiameter * pixelRatio;
    }
  `;
  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D photoMap;
    uniform vec4 photoPlane;
    uniform vec2 rasterToCSS;
    uniform float surfaceHeight;
    varying float visibility;
    varying mediump vec2 photoUV;
    varying mediump float baseDiameter;
    varying mediump float sizeFactor;
    varying mediump float spriteDiameter;
    void main() {
      vec3 centreColor = texture2D(photoMap, clamp(photoUV, vec2(0.0), vec2(1.0))).rgb;
      float tone = clamp(dot(centreColor, vec3(0.299, 0.587, 0.114)) * 1.1, 0.0, 1.0);
      // Each circular particle is a moving hole onto an unmoving photograph.
      // gl_FragCoord makes colour independent of particle identity, gathering,
      // cursor displacement and the orientation of gl_PointCoord.
      vec2 screenPixel = vec2(gl_FragCoord.x * rasterToCSS.x,
        surfaceHeight - gl_FragCoord.y * rasterToCSS.y);
      vec2 pixelUV = (screenPixel - photoPlane.xy) / photoPlane.zw;
      vec3 particleColor = texture2D(photoMap, clamp(pixelUV, vec2(0.0), vec2(1.0))).rgb;
      float diameter = max(0.65, (baseDiameter + (1.0 - tone) * 1.65) * sizeFactor);
      float radius = length(gl_PointCoord - 0.5) * spriteDiameter / diameter;
      float edge = 1.0 - smoothstep(0.35, 0.5, radius);
      gl_FragColor = vec4(particleColor, edge * visibility);
    }
  `;

  function compileShader(type, source) {
    const shader = graphics.createShader(type);
    graphics.shaderSource(shader, source);
    graphics.compileShader(shader);
    if (!graphics.getShaderParameter(shader, graphics.COMPILE_STATUS)) {
      graphics.deleteShader(shader);
      throw new Error('Portrait shader unavailable');
    }
    return shader;
  }
  let program;
  try {
    program = graphics.createProgram();
    const vertex = compileShader(graphics.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(graphics.FRAGMENT_SHADER, fragmentSource);
    graphics.attachShader(program, vertex);
    graphics.attachShader(program, fragment);
    graphics.linkProgram(program);
    graphics.deleteShader(vertex);
    graphics.deleteShader(fragment);
    if (!graphics.getProgramParameter(program, graphics.LINK_STATUS)) throw new Error('Portrait program unavailable');
  } catch { canvas.remove(); staticPhoto('fallback'); return; }

  graphics.useProgram(program);
  const buffer = graphics.createBuffer();
  graphics.bindBuffer(graphics.ARRAY_BUFFER, buffer);
  const attributes = { position: [2, 0], seed: [1, 8] };
  for (const [name, layout] of Object.entries(attributes)) {
    const location = graphics.getAttribLocation(program, name);
    graphics.enableVertexAttribArray(location);
    graphics.vertexAttribPointer(location, layout[0], graphics.FLOAT, false, 12, layout[1]);
  }
  graphics.enable(graphics.BLEND);
  graphics.blendFuncSeparate(graphics.SRC_ALPHA, graphics.ONE_MINUS_SRC_ALPHA, graphics.ONE, graphics.ONE_MINUS_SRC_ALPHA);
  graphics.clearColor(0, 0, 0, 0);
  const uniforms = Object.fromEntries(['resolution', 'compact', 'sourceScale', 'gather', 'clock', 'pixelRatio', 'spacing', 'cursor', 'energy', 'presence', 'velocity', 'revealOrigin', 'revealRadius', 'revealSoftness', 'revealing', 'photoMap', 'photoPlane', 'rasterToCSS', 'surfaceHeight'].map((name) => [name, graphics.getUniformLocation(program, name)]));
  const photoTexture = graphics.createTexture();
  let textureSource = '';
  const pointer = { active: false, targetX: 0, targetY: 0, trailX: 0, trailY: 0, sampleTime: null, sampleInterval: 16.7, inputVelocityX: 0, inputVelocityY: 0, velocityX: 0, velocityY: 0, energy: 0, presence: 0 };
  const rect = { x: 0, y: 0, width: 1, height: 1 };
  const reveal = { started: false, elapsed: 0, progress: 0, visibleProgress: 0, u: 0.5, v: 0.5, radius: 0, softness: 36 };
  let sourceScale = 1.85;
  let targetGather = clamp(Number(story.dataset.gatherProgress) || 0);
  let gather = targetGather;
  let active = true;
  let pointCount = 0;
  let elapsed = 0;
  let previousFrame = 0;
  let frameId = 0;
  let ready = false;
  let visible = true;
  let lost = false;
  let forcedPhoto = false;
  let resizeFrame = 0;
  let resizeSignature = '';
  let lastIntentX = null;
  let lastIntentY = null;
  let touchDown = null;
  function motionStopped() {
    return reduced.matches || document.documentElement.classList.contains('motion-off');
  }
  function enabled() {
    return ready && active && visible && !lost && !document.hidden && !motionStopped();
  }
  function state(name) {
    if (name !== stage.dataset.gatherState) stage.dataset.gatherState = name;
    stage.dataset.gatherProgress = gather.toFixed(4);
    stage.dataset.windowScale = (sourceScale + (1 - sourceScale) * gather).toFixed(4);
    stage.dataset.revealProgress = reveal.visibleProgress.toFixed(4);
  }
  function resetReveal() {
    reveal.started = false;
    reveal.elapsed = reveal.progress = reveal.visibleProgress = reveal.radius = 0;
    target.style.setProperty('--photo-opacity', '0');
    target.style.setProperty('--reveal-radius', '0px');
    graphics.uniform1f(uniforms.revealing, 0);
  }
  function updateReveal() {
    // A geometry refresh must not replace the complete reduced-motion fallback.
    if (motionStopped()) { staticPhoto('static'); return; }
    const x = reveal.u * rect.width;
    const y = reveal.v * rect.height;
    reveal.softness = clamp(rect.width * 0.09, 25, 64);
    const reach = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) + reveal.softness;
    const eased = 1 - Math.pow(1 - reveal.progress, 2.1);
    // Reverse scroll closes the same ripple before the field expands again.
    // Use smoothed *actual* gathering so a scroll jump cannot cut the photo off.
    const returnT = clamp((gather - 0.78) / 0.20);
    const returnWave = returnT * returnT * (3 - 2 * returnT);
    reveal.visibleProgress = reveal.progress * returnWave;
    reveal.radius = reach * eased * returnWave;
    target.style.setProperty('--reveal-x', `${x.toFixed(2)}px`);
    target.style.setProperty('--reveal-y', `${y.toFixed(2)}px`);
    target.style.setProperty('--reveal-radius', `${reveal.radius.toFixed(2)}px`);
    target.style.setProperty('--reveal-softness', `${reveal.softness.toFixed(2)}px`);
    graphics.uniform2f(uniforms.revealOrigin, rect.x + x, rect.y + y);
    graphics.uniform1f(uniforms.revealRadius, reveal.radius);
    graphics.uniform1f(uniforms.revealSoftness, reveal.softness);
    graphics.uniform1f(uniforms.revealing, reveal.started ? 1 : 0);
  }
  function startReveal(localX = rect.width * 0.5, localY = rect.height * 0.5) {
    if (motionStopped() || lost || !ready) { staticPhoto(lost ? 'fallback' : 'static'); return; }
    if (targetGather < 0.98 || gather < 0.975 || reveal.started || !active) return;
    reveal.started = true;
    reveal.u = clamp(localX / rect.width);
    reveal.v = clamp(localY / rect.height);
    reveal.elapsed = reveal.progress = 0;
    target.style.setProperty('--photo-opacity', '1');
    state('revealing');
    updateReveal();
    wake();
  }
  function drawParticles() {
    graphics.clear(graphics.COLOR_BUFFER_BIT);
    graphics.drawArrays(graphics.POINTS, 0, pointCount);
  }
  function sampleHash(column, row, salt) {
    let value = Math.imul(column + 1, 73856093) ^ Math.imul(row + 1, 19349663) ^ salt;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }
  function resize() {
    const width = stage.offsetWidth;
    const height = stage.offsetHeight;
    if (lost || !width || !height || !portrait.naturalWidth) return;
    try {
      graphics.useProgram(program);
      graphics.bindBuffer(graphics.ARRAY_BUFFER, buffer);
      const stageBounds = stage.getBoundingClientRect();
      const bounds = target.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      rect.x = bounds.left - stageBounds.left;
      rect.y = bounds.top - stageBounds.top;
      rect.width = bounds.width;
      rect.height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const signature = JSON.stringify([width, height, ratio, rect.x, rect.y, rect.width, rect.height, portrait.currentSrc || portrait.src, portrait.naturalWidth, portrait.naturalHeight]);
      canvas.style.left = canvas.style.top = '0px';
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (signature === resizeSignature) return;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      graphics.viewport(0, 0, canvas.width, canvas.height);
      graphics.uniform2f(uniforms.resolution, width, height);
      graphics.uniform4f(uniforms.compact, rect.x, rect.y, rect.width, rect.height);
      graphics.uniform1f(uniforms.pixelRatio, ratio);
      sourceScale = width <= 700 ? 1.55 : 1.85;
      graphics.uniform1f(uniforms.sourceScale, sourceScale);
      graphics.uniform4f(uniforms.photoPlane,
        rect.x + rect.width * (1 - sourceScale) * 0.60,
        rect.y + rect.height * (1 - sourceScale) * 0.48,
        rect.width * sourceScale, rect.height * sourceScale);
      graphics.uniform2f(uniforms.rasterToCSS, width / canvas.width, height / canvas.height);
      graphics.uniform1f(uniforms.surfaceHeight, height);
      // CSS image coordinates and GPU UV coordinates use the same image plane.
      target.style.setProperty('--source-width', `${rect.width * sourceScale}px`);
      target.style.setProperty('--source-height', `${rect.height * sourceScale}px`);
      target.style.setProperty('--source-left', `${rect.width * (1 - sourceScale) * 0.60}px`);
      target.style.setProperty('--source-top', `${rect.height * (1 - sourceScale) * 0.48}px`);
      stage.dataset.sceneScale = String(sourceScale);
      const spacing = rect.width < 500 ? 4.5 : 5.5;
      const sampleSpacing = rect.width < 500 ? 3.9 : 4.5;
      const columns = Math.ceil(rect.width / sampleSpacing);
      const rows = Math.ceil(rect.height / sampleSpacing);
      const source = portrait.currentSrc || portrait.src;
      graphics.activeTexture(graphics.TEXTURE0);
      graphics.bindTexture(graphics.TEXTURE_2D, photoTexture);
      if (textureSource !== source) {
        const sampler = document.createElement('canvas');
        const limit = Math.min(2048, graphics.getParameter(graphics.MAX_TEXTURE_SIZE));
        const textureScale = Math.min(1, limit / Math.max(portrait.naturalWidth, portrait.naturalHeight));
        sampler.width = Math.max(1, Math.round(portrait.naturalWidth * textureScale));
        sampler.height = Math.max(1, Math.round(portrait.naturalHeight * textureScale));
        const context = sampler.getContext('2d');
        context.drawImage(portrait, 0, 0, sampler.width, sampler.height);
        graphics.pixelStorei(graphics.UNPACK_FLIP_Y_WEBGL, false);
        graphics.pixelStorei(graphics.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_WRAP_S, graphics.CLAMP_TO_EDGE);
        graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_WRAP_T, graphics.CLAMP_TO_EDGE);
        graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_MIN_FILTER, graphics.LINEAR);
        graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_MAG_FILTER, graphics.LINEAR);
        graphics.texImage2D(graphics.TEXTURE_2D, 0, graphics.RGBA, graphics.RGBA, graphics.UNSIGNED_BYTE, sampler);
        textureSource = source;
        stage.dataset.photoTexture = `${sampler.width}x${sampler.height}`;
      }
      graphics.uniform1i(uniforms.photoMap, 0);
      const points = new Float32Array(columns * rows * 3);
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = row * columns + column;
          const pointSeed = sampleHash(column, row, 0x517cc1b7);
          const jitterX = (sampleHash(column, row, 0x68bc21eb) - 0.5) * 0.70;
          const jitterY = (sampleHash(column, row, 0x02e5be93) - 0.5) * 0.70;
          points.set([(column + 0.5 + jitterX) / columns, (row + 0.5 + jitterY) / rows, pointSeed], index * 3);
        }
      }
      pointCount = columns * rows;
      graphics.bufferData(graphics.ARRAY_BUFFER, points, graphics.STATIC_DRAW);
      graphics.uniform1f(uniforms.spacing, spacing);
      graphics.uniform1f(uniforms.gather, gather);
      updateReveal();
      stage.dataset.particleCount = String(pointCount);
      stage.dataset.colorSampling = 'screen-space-apertures';
      resizeSignature = signature;
    } catch { resizeSignature = ''; failPhoto(); }
  }
  function wake() {
    if (enabled() && !frameId) frameId = requestAnimationFrame(draw);
  }
  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resize();
      if (!lost && !ready && pointCount && graphics.getError() === graphics.NO_ERROR) {
        ready = true;
        stage.classList.add('ripple-ready');
        stage.dataset.renderer = 'particles';
        syncMotion();
        window.dispatchEvent(new CustomEvent('portraitready'));
      }
      wake();
    });
  }
  function draw(timestamp) {
    frameId = 0;
    if (!enabled()) return;
    const delta = previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.05) : 1 / 60;
    elapsed += delta;
    previousFrame = timestamp;
    gather += (targetGather - gather) * (1 - Math.exp(-10 * delta));
    if (Math.abs(targetGather - gather) < 0.00015) gather = targetGather;
    if (reveal.started && gather <= 0.78 && targetGather < 0.8) resetReveal();
    if (reveal.started && reveal.progress < 1) {
      reveal.elapsed += delta;
      reveal.progress = clamp(reveal.elapsed / 1.85);
    }
    const follow = 1 - Math.exp(-5 * delta);
    pointer.trailX += (pointer.targetX - pointer.trailX) * follow;
    pointer.trailY += (pointer.targetY - pointer.trailY) * follow;
    pointer.presence += ((pointer.active ? 1 : 0) - pointer.presence) * (1 - Math.exp(-(pointer.active ? 8 : 3) * delta));
    const moving = pointer.active && pointer.sampleTime !== null && timestamp - pointer.sampleTime < Math.min(100, Math.max(50, pointer.sampleInterval * 2));
    const inputSpeed = Math.hypot(pointer.inputVelocityX, pointer.inputVelocityY);
    const momentum = 1 - Math.exp(-(moving ? 10 : 1.1) * delta);
    pointer.velocityX += ((moving ? pointer.inputVelocityX : 0) - pointer.velocityX) * momentum;
    pointer.velocityY += ((moving ? pointer.inputVelocityY : 0) - pointer.velocityY) * momentum;
    const energyDecay = Math.exp(-2 * delta);
    pointer.energy = Math.min(1, pointer.energy * energyDecay + (moving ? inputSpeed * 0.003 * (1 - energyDecay) : 0));
    graphics.useProgram(program);
    graphics.uniform1f(uniforms.clock, elapsed);
    graphics.uniform1f(uniforms.gather, gather);
    graphics.uniform2f(uniforms.cursor, pointer.trailX, pointer.trailY);
    graphics.uniform2f(uniforms.velocity, pointer.velocityX, pointer.velocityY);
    graphics.uniform1f(uniforms.energy, pointer.energy);
    graphics.uniform1f(uniforms.presence, pointer.presence);
    updateReveal();
    state(reveal.visibleProgress === 1 ? 'photo' : reveal.started ? 'revealing' : gather >= 0.975 ? 'poised' : gather <= 0.005 ? 'expanded' : 'gathering');
    drawParticles();
    frameId = requestAnimationFrame(draw);
  }
  function syncMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previousFrame = 0;
    pointer.active = false;
    pointer.sampleTime = null;
    pointer.energy = pointer.presence = pointer.velocityX = pointer.velocityY = pointer.inputVelocityX = pointer.inputVelocityY = 0;
    if (motionStopped()) {
      forcedPhoto = true;
      gather = targetGather;
      staticPhoto('static');
      graphics.clear(graphics.COLOR_BUFFER_BIT);
    } else if (forcedPhoto && !lost) {
      forcedPhoto = false;
      resetReveal();
      stage.dataset.renderer = 'particles';
    }
    wake();
  }
  function failPhoto() {
    ready = false;
    pointCount = 0;
    resizeSignature = '';
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    stage.classList.remove('ripple-ready');
    staticPhoto('fallback');
  }
  function loadPhoto() {
    textureSource = '';
    ready = false;
    resizeSignature = '';
    if (lost || !portrait.naturalWidth) return;
    try {
      resize();
      if (!pointCount || graphics.getError() !== graphics.NO_ERROR) { failPhoto(); return; }
      ready = true;
      stage.classList.add('ripple-ready');
      stage.dataset.renderer = 'particles';
      if (!reveal.started) resetReveal();
      syncMotion();
      window.dispatchEvent(new CustomEvent('portraitready'));
    } catch { failPhoto(); }
  }
  function movePointer(event) {
    if (!enabled() || event.target.closest?.('a, button, input, textarea, select')) return;
    const bounds = canvas.getBoundingClientRect();
    const hasMoved = Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0) > 0
      || (lastIntentX !== null && Math.hypot(event.clientX - lastIntentX, event.clientY - lastIntentY) > 0.25);
    lastIntentX = event.clientX;
    lastIntentY = event.clientY;
    const coalesced = event.getCoalescedEvents?.();
    const samples = coalesced?.length ? coalesced : [event];
    for (const sample of samples) {
      const horizontal = sample.clientX - bounds.left;
      const vertical = sample.clientY - bounds.top;
      const sampleTime = Number.isFinite(sample.timeStamp) ? sample.timeStamp : performance.now();
      const interval = pointer.sampleTime === null ? 0 : sampleTime - pointer.sampleTime;
      if (pointer.active && interval > 0 && interval < 150) {
        const smoothing = 1 - Math.exp(-interval / 25);
        const velocityX = (horizontal - pointer.targetX) * 1000 / interval;
        const velocityY = (vertical - pointer.targetY) * 1000 / interval;
        pointer.inputVelocityX += (velocityX - pointer.inputVelocityX) * smoothing;
        pointer.inputVelocityY += (velocityY - pointer.inputVelocityY) * smoothing;
        pointer.sampleInterval = interval;
      } else if (!pointer.active) {
        pointer.trailX = horizontal;
        pointer.trailY = vertical;
        pointer.inputVelocityX = pointer.inputVelocityY = 0;
      } else if (interval >= 150) {
        pointer.inputVelocityX = pointer.inputVelocityY = 0;
      }
      if (pointer.sampleTime !== null && interval <= 0) continue;
      pointer.targetX = horizontal;
      pointer.targetY = vertical;
      pointer.sampleTime = sampleTime;
      pointer.active = true;
    }
    const x = event.clientX - bounds.left - rect.x;
    const y = event.clientY - bounds.top - rect.y;
    if (hasMoved && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height && event.pointerType !== 'touch') startReveal(x, y);
  }
  story.addEventListener('pointermove', movePointer, { passive: true });
  story.addEventListener('pointerdown', (event) => {
    if (!enabled() || event.target.closest?.('a, button, input, textarea, select')) return;
    movePointer(event);
    if (event.pointerType === 'touch') {
      touchDown = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      return;
    }
    const bounds = target.getBoundingClientRect();
    if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) startReveal(event.clientX - bounds.left, event.clientY - bounds.top);
  }, { passive: true });
  story.addEventListener('pointerleave', () => { pointer.active = false; });
  story.addEventListener('pointercancel', () => { pointer.active = false; touchDown = null; });
  story.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse') pointer.active = false;
    if (event.pointerType === 'touch' && touchDown && event.timeStamp - touchDown.time < 650
      && Math.hypot(event.clientX - touchDown.x, event.clientY - touchDown.y) < 10) {
      const bounds = target.getBoundingClientRect();
      if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) startReveal(event.clientX - bounds.left, event.clientY - bounds.top);
    }
    touchDown = null;
  });
  window.addEventListener('blur', () => { pointer.active = false; });
  window.addEventListener('portraitgather', (event) => {
    const detail = event.detail || {};
    targetGather = clamp(Number(detail.progress) || 0);
    active = detail.active !== false;
    if (detail.instant || !ready) gather = targetGather;
    if (!active) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      previousFrame = 0;
      pointer.active = false;
    }
    if (motionStopped()) staticPhoto('static');
    scheduleResize();
    wake();
  });
  window.addEventListener('portraitreveal', (event) => {
    const origin = event.detail?.origin;
    startReveal(origin?.x ?? rect.width * 0.5, origin?.y ?? rect.height * 0.5);
  });
  window.addEventListener('motionchange', syncMotion);
  reduced.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', scheduleResize);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(stage);
    observer.observe(target);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); }).observe(surface);
  new MutationObserver(() => { if (portrait.complete) loadPhoto(); }).observe(portrait, { attributes: true, attributeFilter: ['src'] });
  portrait.addEventListener('load', loadPhoto);
  portrait.addEventListener('error', failPhoto);
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); lost = true; failPhoto(); });
  canvas.addEventListener('webglcontextrestored', () => { staticPhoto('fallback'); });
  if (portrait.complete) loadPhoto();
})();
