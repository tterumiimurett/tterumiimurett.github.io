(() => {
  const stage = document.getElementById('portrait-stage');
  const portrait = document.getElementById('portrait');
  const surface = document.querySelector('.hero');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.insertBefore(canvas, stage.querySelector('.portrait-fade'));
  const graphics = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!graphics) return;

  const vertexSource = `
    attribute vec2 position;
    attribute float tone;
    uniform vec2 resolution;
    uniform float clock;
    uniform float pixelRatio;
    uniform float spacing;
    uniform vec2 cursor;
    uniform vec2 velocity;
    uniform float energy;
    uniform float presence;
    uniform float idleStrength;
    uniform vec4 ripples[8];
    varying float brightness;
    void main() {
      vec2 delta = position - cursor;
      float distance = length(delta);
      float radius = min(resolution.x * 0.46, 180.0 + energy * 100.0);
      float weight = (1.0 - smoothstep(0.0, radius, distance)) * presence;
      float speed = min(length(velocity) / 700.0, 1.0);
      vec2 direction = velocity / max(length(velocity), 0.001);
      vec2 normal = vec2(-direction.y, direction.x);
      float side = dot(delta, normal) / max(distance, 1.0);
      vec2 displacement = (direction + normal * side * 0.55) * weight * speed * 10.0;
      float crest = sin(distance * 0.045 - clock * 6.0);
      displacement += delta / max(distance, 1.0) * crest * weight * energy * 1.6;
      vec2 water = vec2(0.0);
      float waterLight = 0.0;
      for (int index = 0; index < 8; index++) {
        float age = clock - ripples[index].z;
        if (age >= 0.0 && age < 2.4 && ripples[index].w > 0.0) {
          vec2 offset = position - ripples[index].xy;
          float radius = length(offset);
          float front = radius - age * 120.0;
          float envelope = exp(-pow(front / 55.0, 2.0));
          float life = smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.8, 2.4, age));
          float wave = sin(front * 0.065) * envelope * life * ripples[index].w;
          water += offset / max(radius, 1.0) * wave * 7.0;
          waterLight += wave * 0.10;
        }
      }
      displacement += water / max(1.0, length(water) / 10.0);
      vec2 idleOffset = position - resolution * vec2(0.56, 0.48);
      float idleDistance = length(idleOffset);
      float idleWave = sin(idleDistance * 0.033 - clock * 1.1);
      float idleSecondary = sin(position.y * 0.024 + position.x * 0.012 - clock * 0.8);
      displacement += (idleOffset / max(idleDistance, 1.0) * idleWave * 1.4 + vec2(0.4, 0.7) * idleSecondary * 0.65) * idleStrength;
      vec2 screen = (position + displacement) / resolution;
      gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
      brightness = clamp(tone * 1.12 + weight * speed * 0.035 + clamp(waterLight, -0.10, 0.10) + idleWave * idleStrength * 0.016, 0.0, 1.0);
      gl_PointSize = spacing * (0.36 + 0.48 * sqrt(tone)) * pixelRatio;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying float brightness;
    void main() {
      float distance = length(gl_PointCoord - 0.5);
      float opacity = 1.0 - smoothstep(0.35, 0.5, distance);
      gl_FragColor = vec4(vec3(0.93, 0.93, 0.90) * brightness, opacity);
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
    if (!graphics.getProgramParameter(program, graphics.LINK_STATUS)) return;
  } catch { return; }

  graphics.useProgram(program);
  const buffer = graphics.createBuffer();
  graphics.bindBuffer(graphics.ARRAY_BUFFER, buffer);
  const position = graphics.getAttribLocation(program, 'position');
  const tone = graphics.getAttribLocation(program, 'tone');
  graphics.enableVertexAttribArray(position);
  graphics.enableVertexAttribArray(tone);
  graphics.vertexAttribPointer(position, 2, graphics.FLOAT, false, 12, 0);
  graphics.vertexAttribPointer(tone, 1, graphics.FLOAT, false, 12, 8);
  graphics.enable(graphics.BLEND);
  graphics.blendFunc(graphics.SRC_ALPHA, graphics.ONE_MINUS_SRC_ALPHA);
  graphics.clearColor(0.067, 0.071, 0.063, 1);
  const uniforms = Object.fromEntries(['resolution', 'clock', 'pixelRatio', 'spacing', 'cursor', 'velocity', 'energy', 'presence', 'idleStrength', 'ripples[0]'].map((name) => [name, graphics.getUniformLocation(program, name)]));

  const pointer = { active: false, targetX: 0, targetY: 0, trailX: 0, trailY: 0, sampleTime: null, sampleInterval: 16.7, inputVelocityX: 0, inputVelocityY: 0, velocityX: 0, velocityY: 0, energy: 0, presence: 0 };
  const ripples = new Float32Array(32);
  let rippleIndex = 0;
  let lastRippleTime = -10;
  let lastRippleX = 0;
  let lastRippleY = 0;
  let pointCount = 0;
  let elapsed = 0;
  let idleTime = 0;
  let idleStrength = 0;
  let previousFrame = 0;
  let frameId = 0;
  let ready = false;
  let visible = true;
  let lost = false;

  function enabled() {
    return ready && visible && !lost && !document.hidden && !document.documentElement.classList.contains('motion-off');
  }

  function resize() {
    const width = portrait.offsetWidth;
    const height = portrait.offsetHeight;
    if (lost || portrait.hidden || !width || !height || !portrait.naturalWidth) return;
    try {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.style.left = `${portrait.offsetLeft}px`;
      canvas.style.top = `${portrait.offsetTop}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      graphics.viewport(0, 0, canvas.width, canvas.height);
      graphics.uniform2f(uniforms.resolution, width, height);
      graphics.uniform1f(uniforms.pixelRatio, ratio);
      const scale = Math.max(width / portrait.naturalWidth, height / portrait.naturalHeight);
      const alignment = getComputedStyle(portrait).objectPosition.split(' ').map((value) => parseFloat(value) / 100);
      const spacing = width < 500 ? 4.5 : 5.5;
      const columns = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      const sampler = document.createElement('canvas');
      sampler.width = columns;
      sampler.height = rows;
      const context = sampler.getContext('2d', { willReadFrequently: true });
      context.drawImage(portrait, (width - portrait.naturalWidth * scale) * alignment[0] / spacing, (height - portrait.naturalHeight * scale) * alignment[1] / spacing, portrait.naturalWidth * scale / spacing, portrait.naturalHeight * scale / spacing);
      const pixels = context.getImageData(0, 0, columns, rows).data;
      const points = new Float32Array(columns * rows * 3);
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = row * columns + column;
          const luminance = (pixels[index * 4] * 0.299 + pixels[index * 4 + 1] * 0.587 + pixels[index * 4 + 2] * 0.114) / 255;
          points.set([(column + 0.5) * spacing, (row + 0.5) * spacing, Math.min(1, Math.max(0, luminance * 1.1))], index * 3);
        }
      }
      pointCount = columns * rows;
      graphics.bufferData(graphics.ARRAY_BUFFER, points, graphics.STATIC_DRAW);
      graphics.uniform1f(uniforms.spacing, spacing);
    } catch { resetPhoto(); }
  }

  function draw(timestamp) {
    frameId = 0;
    if (!enabled()) return;
    const delta = previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.05) : 1 / 60;
    elapsed += delta;
    previousFrame = timestamp;
    const follow = 1 - Math.exp(-5.5 * delta);
    pointer.trailX += (pointer.targetX - pointer.trailX) * follow;
    pointer.trailY += (pointer.targetY - pointer.trailY) * follow;
    pointer.presence += ((pointer.active ? 1 : 0) - pointer.presence) * (1 - Math.exp(-(pointer.active ? 8 : 3) * delta));
    const moving = pointer.active && pointer.sampleTime !== null && timestamp - pointer.sampleTime < Math.min(100, Math.max(50, pointer.sampleInterval * 2));
    idleTime = moving && Math.hypot(pointer.inputVelocityX, pointer.inputVelocityY) > 3 ? 0 : idleTime + delta;
    const idleTarget = idleTime > 1.2 ? 1 : 0;
    idleStrength += (idleTarget - idleStrength) * (1 - Math.exp(-(idleTarget ? 1.2 : 5) * delta));
    const momentum = 1 - Math.exp(-(moving ? 10 : 1.4) * delta);
    pointer.velocityX += ((moving ? pointer.inputVelocityX : 0) - pointer.velocityX) * momentum;
    pointer.velocityY += ((moving ? pointer.inputVelocityY : 0) - pointer.velocityY) * momentum;
    const targetEnergy = moving ? Math.min(1, Math.hypot(pointer.inputVelocityX, pointer.inputVelocityY) / 650) : 0;
    pointer.energy += (targetEnergy - pointer.energy) * (1 - Math.exp(-(moving ? 8 : 2.2) * delta));
    if (moving && Math.hypot(pointer.inputVelocityX, pointer.inputVelocityY) > 25 && elapsed - lastRippleTime >= 0.32 && (elapsed - lastRippleTime > 2.4 || Math.hypot(pointer.trailX - lastRippleX, pointer.trailY - lastRippleY) > 45)) {
      addRipple(pointer.trailX, pointer.trailY, 0.85);
    }
    graphics.uniform1f(uniforms.clock, elapsed);
    graphics.uniform2f(uniforms.cursor, pointer.trailX, pointer.trailY);
    graphics.uniform2f(uniforms.velocity, pointer.velocityX, pointer.velocityY);
    graphics.uniform1f(uniforms.energy, pointer.energy);
    graphics.uniform1f(uniforms.presence, pointer.presence);
    graphics.uniform1f(uniforms.idleStrength, idleStrength);
    graphics.uniform4fv(uniforms['ripples[0]'], ripples);
    graphics.clear(graphics.COLOR_BUFFER_BIT);
    graphics.drawArrays(graphics.POINTS, 0, pointCount);
    frameId = requestAnimationFrame(draw);
  }

  function syncMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previousFrame = 0;
    idleTime = idleStrength = 0;
    ripples.fill(0);
    lastRippleTime = -10;
    pointer.active = false;
    pointer.sampleTime = null;
    pointer.energy = pointer.presence = pointer.velocityX = pointer.velocityY = pointer.inputVelocityX = pointer.inputVelocityY = 0;
    if (enabled()) frameId = requestAnimationFrame(draw);
  }

  function resetPhoto() {
    ready = false;
    stage.classList.remove('ripple-ready');
    syncMotion();
  }

  function loadPhoto() {
    resetPhoto();
    if (lost || portrait.hidden || !portrait.naturalWidth) return;
    try {
      pointCount = 0;
      resize();
      if (!pointCount || graphics.getError() !== graphics.NO_ERROR) return;
      ready = true;
      stage.classList.add('ripple-ready');
      syncMotion();
    } catch { resetPhoto(); }
  }

  function movePointer(event) {
    if (!enabled() || event.target.closest('a, button, input')) return;
    const bounds = canvas.getBoundingClientRect();
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
  }

  function addRipple(horizontal, vertical, strength) {
    ripples.set([horizontal, vertical, elapsed, strength], rippleIndex * 4);
    rippleIndex = (rippleIndex + 1) % 8;
    lastRippleTime = elapsed;
    lastRippleX = horizontal;
    lastRippleY = vertical;
  }

  surface.addEventListener('pointermove', movePointer, { passive: true });
  surface.addEventListener('pointerdown', (event) => {
    if (!enabled() || event.target.closest('a, button, input')) return;
    movePointer(event);
    idleTime = 0;
    addRipple(pointer.targetX, pointer.targetY, 1);
  }, { passive: true });
  surface.addEventListener('pointerleave', () => { pointer.active = false; });
  surface.addEventListener('pointercancel', () => { pointer.active = false; });
  surface.addEventListener('pointerup', (event) => { if (event.pointerType !== 'mouse') pointer.active = false; });
  window.addEventListener('blur', () => { pointer.active = false; });
  window.addEventListener('motionchange', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(portrait);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); }).observe(surface);
  }
  new MutationObserver(() => {
    resetPhoto();
    if (portrait.complete) loadPhoto();
  }).observe(portrait, { attributes: true, attributeFilter: ['src', 'hidden'] });
  portrait.addEventListener('load', loadPhoto);
  portrait.addEventListener('error', resetPhoto);
  canvas.addEventListener('webglcontextlost', () => { lost = true; resetPhoto(); });
  if (portrait.complete) loadPhoto();
})();
