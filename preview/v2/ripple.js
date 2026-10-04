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
    attribute float seed;
    uniform vec2 resolution;
    uniform float clock;
    uniform float pixelRatio;
    uniform float spacing;
    uniform vec2 cursor;
    uniform float energy;
    uniform float presence;
    uniform vec2 velocity;
    varying float brightness;
    varying float visibility;
    varying float glow;
    void main() {
      float scale = spacing / 8.0;
      vec2 delta = position - cursor;
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
      glow = clamp(influence * highlight * (0.35 + energy * 0.65), 0.0, 1.0);
      vec2 idleOffset = position - resolution * vec2(0.56, 0.48);
      float idleDistance = length(idleOffset);
      float idleWave = sin(idleDistance * 0.033 - clock * 1.1);
      float idleSecondary = sin(position.y * 0.024 + position.x * 0.012 - clock * 0.8);
      displacement += idleOffset / max(idleDistance, 1.0) * idleWave * 1.4 + vec2(0.4, 0.7) * idleSecondary * 0.65;
      vec2 screen = (position + displacement) / resolution;
      gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
      float fine = 1.0 - smoothstep(0.08, 0.40, tone);
      float ambientReveal = smoothstep(-0.25, 0.45, idleWave * 0.65 + idleSecondary * 0.35);
      float cursorReveal = smoothstep(0.02, 0.45, glow);
      float fineReveal = mix(ambientReveal, 1.0, cursorReveal);
      visibility = mix(1.0, fineReveal, fine);
      float lit = pow(tone, 0.42);
      float waveBand = (ambientReveal * 2.0 - 1.0) * (1.0 - lit * 0.7);
      float raised = smoothstep(0.05, 0.13, lit);
      glow = min(1.0, glow + raised * 0.072);
      float diameter = max(0.7, 1.4 + lit * 3.5 + raised * 0.6 + glow * 1.3 + waveBand * 1.15) * scale;
      brightness = clamp((0.24 + lit * 0.76) * (1.0 + waveBand * 0.42) + glow * 0.75, 0.0, 1.0);
      gl_PointSize = diameter * pixelRatio;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying float brightness;
    varying float visibility;
    varying float glow;
    void main() {
      float distance = length(gl_PointCoord - 0.5);
      float core = 1.0 - smoothstep(0.05, 0.5, distance);
      float opacity = core * brightness;
      gl_FragColor = vec4(vec3(0.93, 0.93, 0.90), opacity * visibility);
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
  const seed = graphics.getAttribLocation(program, 'seed');
  graphics.enableVertexAttribArray(position);
  graphics.enableVertexAttribArray(tone);
  graphics.enableVertexAttribArray(seed);
  graphics.vertexAttribPointer(position, 2, graphics.FLOAT, false, 16, 0);
  graphics.vertexAttribPointer(tone, 1, graphics.FLOAT, false, 16, 8);
  graphics.vertexAttribPointer(seed, 1, graphics.FLOAT, false, 16, 12);
  graphics.enable(graphics.BLEND);
  graphics.blendFunc(graphics.SRC_ALPHA, graphics.ONE_MINUS_SRC_ALPHA);
  graphics.clearColor(0.067, 0.071, 0.063, 1);
  const uniforms = Object.fromEntries(['resolution', 'clock', 'pixelRatio', 'spacing', 'cursor', 'energy', 'presence', 'velocity'].map((name) => [name, graphics.getUniformLocation(program, name)]));

  const pointer = { active: false, targetX: 0, targetY: 0, trailX: 0, trailY: 0, sampleTime: null, sampleInterval: 16.7, inputVelocityX: 0, inputVelocityY: 0, velocityX: 0, velocityY: 0, energy: 0, presence: 0 };
  let pointCount = 0;
  let elapsed = 0;
  let previousFrame = 0;
  let frameId = 0;
  let ready = false;
  let visible = true;
  let lost = false;
  let glowRenderer = null;
  try { glowRenderer = createGlowRenderer(); } catch {}

  function createGlowRenderer() {
    const screenVertex = `
      attribute vec2 corner;
      varying vec2 uv;
      void main() {
        uv = corner * 0.5 + 0.5;
        gl_Position = vec4(corner, 0.0, 1.0);
      }
    `;
    const screenFragment = `
      precision mediump float;
      uniform sampler2D source;
      uniform sampler2D bloom;
      uniform vec2 stepSize;
      uniform int pass;
      varying vec2 uv;
      void main() {
        vec3 color = texture2D(source, uv).rgb;
        if (pass == 0) {
          float peak = max(color.r, max(color.g, color.b));
          color *= smoothstep(0.48, 0.73, peak);
        } else if (pass == 1) {
          color *= 0.227027;
          color += (texture2D(source, uv + stepSize * 1.384615).rgb + texture2D(source, uv - stepSize * 1.384615).rgb) * 0.316216;
          color += (texture2D(source, uv + stepSize * 3.230769).rgb + texture2D(source, uv - stepSize * 3.230769).rgb) * 0.070270;
        } else {
          color += texture2D(bloom, uv).rgb * 0.55;
          color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    const screenProgram = graphics.createProgram();
    const vertex = compileShader(graphics.VERTEX_SHADER, screenVertex);
    const fragment = compileShader(graphics.FRAGMENT_SHADER, screenFragment);
    graphics.attachShader(screenProgram, vertex);
    graphics.attachShader(screenProgram, fragment);
    graphics.bindAttribLocation(screenProgram, 0, 'corner');
    graphics.linkProgram(screenProgram);
    graphics.deleteShader(vertex);
    graphics.deleteShader(fragment);
    if (!graphics.getProgramParameter(screenProgram, graphics.LINK_STATUS)) {
      graphics.deleteProgram(screenProgram);
      throw new Error('Portrait glow unavailable');
    }
    const screenBuffer = graphics.createBuffer();
    graphics.bindBuffer(graphics.ARRAY_BUFFER, screenBuffer);
    graphics.bufferData(graphics.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), graphics.STATIC_DRAW);
    const settings = Object.fromEntries(['source', 'bloom', 'stepSize', 'pass'].map((name) => [name, graphics.getUniformLocation(screenProgram, name)]));
    let targets = [];

    function clearTargets() {
      for (const target of targets) {
        graphics.deleteFramebuffer(target.framebuffer);
        graphics.deleteTexture(target.texture);
      }
      targets = [];
    }

    function resize(width, height) {
      clearTargets();
      try {
        for (const divisor of [1, 2, 2]) {
          const target = { width: Math.max(1, Math.round(width / divisor)), height: Math.max(1, Math.round(height / divisor)), texture: graphics.createTexture(), framebuffer: graphics.createFramebuffer() };
          targets.push(target);
          graphics.bindTexture(graphics.TEXTURE_2D, target.texture);
          graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_MIN_FILTER, graphics.LINEAR);
          graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_MAG_FILTER, graphics.LINEAR);
          graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_WRAP_S, graphics.CLAMP_TO_EDGE);
          graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_WRAP_T, graphics.CLAMP_TO_EDGE);
          graphics.texImage2D(graphics.TEXTURE_2D, 0, graphics.RGBA, target.width, target.height, 0, graphics.RGBA, graphics.UNSIGNED_BYTE, null);
          graphics.bindFramebuffer(graphics.FRAMEBUFFER, target.framebuffer);
          graphics.framebufferTexture2D(graphics.FRAMEBUFFER, graphics.COLOR_ATTACHMENT0, graphics.TEXTURE_2D, target.texture, 0);
          if (graphics.checkFramebufferStatus(graphics.FRAMEBUFFER) !== graphics.FRAMEBUFFER_COMPLETE) throw new Error('Portrait glow target unavailable');
        }
      } catch (error) {
        clearTargets();
        throw error;
      } finally {
        graphics.bindFramebuffer(graphics.FRAMEBUFFER, null);
      }
    }

    function pass(source, target, mode, horizontal = 0, vertical = 0) {
      graphics.bindFramebuffer(graphics.FRAMEBUFFER, target?.framebuffer || null);
      graphics.viewport(0, 0, target?.width || canvas.width, target?.height || canvas.height);
      graphics.activeTexture(graphics.TEXTURE0);
      graphics.bindTexture(graphics.TEXTURE_2D, source.texture);
      graphics.uniform1i(settings.source, 0);
      graphics.uniform1i(settings.pass, mode);
      graphics.uniform2f(settings.stepSize, horizontal, vertical);
      graphics.drawArrays(graphics.TRIANGLE_STRIP, 0, 4);
    }

    function draw() {
      const [scene, first, second] = targets;
      graphics.bindFramebuffer(graphics.FRAMEBUFFER, scene.framebuffer);
      graphics.viewport(0, 0, scene.width, scene.height);
      drawParticles(true);
      graphics.disable(graphics.BLEND);
      graphics.useProgram(screenProgram);
      graphics.disableVertexAttribArray(position);
      graphics.disableVertexAttribArray(tone);
      graphics.disableVertexAttribArray(seed);
      graphics.enableVertexAttribArray(0);
      graphics.bindBuffer(graphics.ARRAY_BUFFER, screenBuffer);
      graphics.vertexAttribPointer(0, 2, graphics.FLOAT, false, 0, 0);
      graphics.activeTexture(graphics.TEXTURE1);
      graphics.bindTexture(graphics.TEXTURE_2D, scene.texture);
      pass(scene, first, 0);
      pass(first, second, 1, 1.5 / first.width, 0);
      pass(second, first, 1, 0, 1.5 / second.height);
      graphics.activeTexture(graphics.TEXTURE1);
      graphics.bindTexture(graphics.TEXTURE_2D, first.texture);
      graphics.uniform1i(settings.bloom, 1);
      pass(scene, null, 2);
    }

    function dispose() {
      clearTargets();
      graphics.deleteBuffer(screenBuffer);
      graphics.deleteProgram(screenProgram);
    }

    return { resize, draw, dispose };
  }

  function drawParticles(linear) {
    graphics.useProgram(program);
    graphics.bindBuffer(graphics.ARRAY_BUFFER, buffer);
    graphics.enableVertexAttribArray(position);
    graphics.enableVertexAttribArray(tone);
    graphics.enableVertexAttribArray(seed);
    graphics.vertexAttribPointer(position, 2, graphics.FLOAT, false, 16, 0);
    graphics.vertexAttribPointer(tone, 1, graphics.FLOAT, false, 16, 8);
    graphics.vertexAttribPointer(seed, 1, graphics.FLOAT, false, 16, 12);
    graphics.enable(graphics.BLEND);
    graphics.clearColor(linear ? 0.0026 : 0.067, linear ? 0.003 : 0.071, linear ? 0.0023 : 0.063, 1);
    graphics.clear(graphics.COLOR_BUFFER_BIT);
    graphics.drawArrays(graphics.POINTS, 0, pointCount);
  }

  function enabled() {
    return ready && visible && !lost && !document.hidden && !document.documentElement.classList.contains('motion-off');
  }

  function resize() {
    const width = portrait.offsetWidth;
    const height = portrait.offsetHeight;
    if (lost || portrait.hidden || !width || !height || !portrait.naturalWidth) return;
    try {
      graphics.useProgram(program);
      graphics.bindBuffer(graphics.ARRAY_BUFFER, buffer);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.style.left = `${portrait.offsetLeft}px`;
      canvas.style.top = `${portrait.offsetTop}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      if (glowRenderer) {
        try { glowRenderer.resize(canvas.width, canvas.height); }
        catch { glowRenderer.dispose(); glowRenderer = null; }
      }
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
      const points = new Float32Array(columns * rows * 4);
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = row * columns + column;
          const luminance = (pixels[index * 4] * 0.299 + pixels[index * 4 + 1] * 0.587 + pixels[index * 4 + 2] * 0.114) / 255;
          const seed = ((Math.imul(column + 1, 73856093) ^ Math.imul(row + 1, 19349663)) >>> 0) / 4294967296;
          points.set([(column + 0.5) * spacing, (row + 0.5) * spacing, Math.min(1, Math.max(0, luminance * 1.1)), seed], index * 4);
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
    graphics.uniform2f(uniforms.cursor, pointer.trailX, pointer.trailY);
    graphics.uniform2f(uniforms.velocity, pointer.velocityX, pointer.velocityY);
    graphics.uniform1f(uniforms.energy, pointer.energy);
    graphics.uniform1f(uniforms.presence, pointer.presence);
    if (glowRenderer) glowRenderer.draw();
    else drawParticles(false);
    frameId = requestAnimationFrame(draw);
  }

  function syncMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previousFrame = 0;
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

  surface.addEventListener('pointermove', movePointer, { passive: true });
  surface.addEventListener('pointerdown', (event) => {
    if (!enabled() || event.target.closest('a, button, input')) return;
    movePointer(event);
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
