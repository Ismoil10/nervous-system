// WebGL2 helpers: shader compilation, framebuffer and buffer management.

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  // HDR needs a floating-point render target. Otherwise we fall back to RGBA8.
  const floatExt = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  return { gl, hdr: !!floatExt };
}

function compileShader(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error (${label}): ${log}`);
  }
  return shader;
}

export function createProgram(gl, vsSource, fsSource, label = 'program') {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource, label + '.vs');
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource, label + '.fs');
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error (${label}): ${gl.getProgramInfoLog(program)}`);
  }
  // Collect the uniform locations once.
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

// Builds a VAO from an interleaved Float32Array. layout: [{ loc, size }] — attributes packed consecutively.
export function createInterleavedVAO(gl, data, layout) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const stride = layout.reduce((s, a) => s + a.size, 0) * 4;
  let offset = 0;
  for (const attr of layout) {
    gl.enableVertexAttribArray(attr.loc);
    gl.vertexAttribPointer(attr.loc, attr.size, gl.FLOAT, false, stride, offset);
    offset += attr.size * 4;
  }
  gl.bindVertexArray(null);
  return { vao, buffer };
}

export function createTarget(gl, width, height, hdr) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const internal = hdr ? gl.RGBA16F : gl.RGBA8;
  const type = hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return null;
  }
  return { tex, fbo, width, height };
}

export function deleteTarget(gl, target) {
  if (!target) return;
  gl.deleteFramebuffer(target.fbo);
  gl.deleteTexture(target.tex);
}

// GPU timing (when available). Gives a more accurate signal than FPS for adaptive quality.
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.lastMs = null;
  }
  begin() {
    if (!this.ext || this.pending.length > 3) return null;
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    return q;
  }
  end(q) {
    if (!q) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(q);
  }
  poll() {
    if (!this.ext) return null;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      gl.deleteQuery(q);
      this.pending.shift();
      if (!disjoint) this.lastMs = ns / 1e6;
    }
    return this.lastMs;
  }
}
