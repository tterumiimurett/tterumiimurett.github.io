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
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D photo;
    uniform vec2 resolution;
    uniform vec2 crop;
    uniform vec2 alignment;
    uniform float clock;
    uniform float pixelRatio;
    uniform vec4 waves[8];
    void main() {
      vec2 point = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / pixelRatio;
      vec2 size = resolution / pixelRatio;
      vec2 displacement = vec2(0.0);
      float crest = 0.0;
      float ambientDistance = length(point - size * vec2(0.63, 0.42));
      float ambient = sin(ambientDistance * 0.034 - clock * 1.7);
      displacement += (point - size * vec2(0.63, 0.42)) / max(ambientDistance, 1.0) * ambient * 3.5;
      for (int index = 0; index < 8; index++) {
        float age = clock - waves[index].z;
        vec2 delta = point - waves[index].xy;
        float distance = length(delta);
        float front = distance - age * 190.0;
        float envelope = exp(-pow(front / 85.0, 2.0)) * exp(-age * 0.85);
        float wave = sin(front * 0.072) * envelope * waves[index].w;
        displacement += delta / max(distance, 1.0) * wave * 24.0;
        crest += wave;
      }
      vec2 warped = point + displacement;
      float spacing = size.x < 500.0 ? 4.0 : 5.0;
      vec2 cell = (floor(warped / spacing) + 0.5) * spacing;
      vec2 photoUv = cell / size * crop + (1.0 - crop) * alignment;
      vec3 sampleColor = texture2D(photo, clamp(photoUv, 0.0, 1.0)).rgb;
      float luminance = dot(sampleColor, vec3(0.299, 0.587, 0.114));
      luminance = clamp((luminance - 0.5) * 1.1 + 0.55, 0.0, 1.0);
      float radius = spacing * (0.18 + 0.25 * sqrt(luminance));
      float dotMask = 1.0 - smoothstep(radius - 0.5, radius + 0.5, length(warped - cell));
      vec3 background = vec3(0.067, 0.071, 0.063);
      vec3 ink = vec3(0.93, 0.93, 0.90) * clamp(luminance * 1.3 + crest * 0.18, 0.0, 1.0);
      gl_FragColor = vec4(mix(background, ink, dotMask), 1.0);
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
  graphics.bufferData(graphics.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), graphics.STATIC_DRAW);
  const position = graphics.getAttribLocation(program, 'position');
  graphics.enableVertexAttribArray(position);
  graphics.vertexAttribPointer(position, 2, graphics.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['photo', 'resolution', 'crop', 'alignment', 'clock', 'pixelRatio', 'waves[0]'].map((name) => [name, graphics.getUniformLocation(program, name)]));
  const texture = graphics.createTexture();
  graphics.bindTexture(graphics.TEXTURE_2D, texture);
  graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_WRAP_S, graphics.CLAMP_TO_EDGE);
  graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_WRAP_T, graphics.CLAMP_TO_EDGE);
  graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_MIN_FILTER, graphics.LINEAR);
  graphics.texParameteri(graphics.TEXTURE_2D, graphics.TEXTURE_MAG_FILTER, graphics.LINEAR);
  graphics.uniform1i(uniforms.photo, 0);

  const waves = new Float32Array(32);
  let waveIndex = 0;
  let elapsed = 0;
  let previousFrame = 0;
  let frameId = 0;
  let ready = false;
  let visible = true;
  let lost = false;
  let lastPointer = 0;

  function enabled() {
    return ready && visible && !lost && !document.hidden && !document.documentElement.classList.contains('motion-off');
  }

  function resize() {
    const width = portrait.offsetWidth;
    const height = portrait.offsetHeight;
    if (!width || !height || !portrait.naturalWidth) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.style.left = `${portrait.offsetLeft}px`;
    canvas.style.top = `${portrait.offsetTop}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    graphics.viewport(0, 0, canvas.width, canvas.height);
    graphics.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    graphics.uniform1f(uniforms.pixelRatio, ratio);
    const scale = Math.max(width / portrait.naturalWidth, height / portrait.naturalHeight);
    graphics.uniform2f(uniforms.crop, width / (portrait.naturalWidth * scale), height / (portrait.naturalHeight * scale));
    const alignment = getComputedStyle(portrait).objectPosition.split(' ').map((value) => parseFloat(value) / 100);
    graphics.uniform2f(uniforms.alignment, alignment[0], alignment[1]);
  }

  function draw(timestamp) {
    frameId = 0;
    if (!enabled()) return;
    if (!previousFrame || timestamp - previousFrame >= 30) {
      elapsed += previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.1) : 0;
      previousFrame = timestamp;
      graphics.uniform1f(uniforms.clock, elapsed);
      graphics.uniform4fv(uniforms['waves[0]'], waves);
      graphics.drawArrays(graphics.TRIANGLES, 0, 3);
    }
    frameId = requestAnimationFrame(draw);
  }

  function syncMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previousFrame = 0;
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
      graphics.texImage2D(graphics.TEXTURE_2D, 0, graphics.RGB, graphics.RGB, graphics.UNSIGNED_BYTE, portrait);
      if (graphics.getError() !== graphics.NO_ERROR) return;
      resize();
      ready = true;
      stage.classList.add('ripple-ready');
      syncMotion();
    } catch { resetPhoto(); }
  }

  function addWave(event, strength) {
    if (!enabled() || event.target.closest('a, button, input')) return;
    const bounds = canvas.getBoundingClientRect();
    const offset = waveIndex * 4;
    waves.set([event.clientX - bounds.left, event.clientY - bounds.top, elapsed, strength], offset);
    waveIndex = (waveIndex + 1) % 8;
  }

  surface.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || event.timeStamp - lastPointer < 100) return;
    lastPointer = event.timeStamp;
    addWave(event, 0.6);
  });
  surface.addEventListener('pointerdown', (event) => addWave(event, 1.8));
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
