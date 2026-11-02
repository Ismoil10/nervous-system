// WebGL2 helpers: shader compilation, framebuffer, buffer and data-texture management.

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

// Attribute component types: [GL enum name, bytes].
const ATTR_TYPES = {
  f32: ['FLOAT', 4], u8: ['UNSIGNED_BYTE', 1], i8: ['BYTE', 1], u16: ['UNSIGNED_SHORT', 2],
  i16: ['SHORT', 2], u32: ['UNSIGNED_INT', 4], i32: ['INT', 4],
};

function bindAttributes(gl, buffer, layout) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const bytes = (a) => ATTR_TYPES[a.type || 'f32'][1] * a.size;
  const stride = layout.reduce((s, a) => s + bytes(a), 0);
  let offset = 0;
  for (const attr of layout) {
    const glType = gl[ATTR_TYPES[attr.type || 'f32'][0]];
    gl.enableVertexAttribArray(attr.loc);
    // Integer attributes (`in uint` / `in int` in GLSL) need vertexAttribIPointer; anything else is
    // read as float (optionally normalised).
    if (attr.int) gl.vertexAttribIPointer(attr.loc, attr.size, glType, stride, offset);
    else gl.vertexAttribPointer(attr.loc, attr.size, glType, !!attr.normalized, stride, offset);
    offset += bytes(attr);
  }
}

// Builds a VAO from interleaved vertex data. layout: [{ loc, size, type = 'f32', int = false,
// normalized = false, data? }]. Entries without their own `data` are packed consecutively in
// `data`; an entry with `data` gets a separate tightly packed buffer (e.g. a Uint8Array area id
// at location 3 next to a Float32Array star record).
export function createInterleavedVAO(gl, data, layout) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  bindAttributes(gl, buffer, layout.filter((a) => !a.data));
  const buffers = [buffer];
  for (const attr of layout.filter((a) => a.data)) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, attr.data, gl.STATIC_DRAW);
    bindAttributes(gl, b, [attr]);
    buffers.push(b);
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return { vao, buffer, buffers };
}

export function deleteVAO(gl, v) {
  if (!v) return;
  for (const b of v.buffers || [v.buffer]) gl.deleteBuffer(b);
  gl.deleteVertexArray(v.vao);
}

// --- Data textures: per-frame state read in vertex shaders with texelFetch (NEAREST, no mips) ---
// RGBA32F and RGBA16F both accept Float32Array uploads with type FLOAT (WebGL2 / ES 3.0).
export function createDataTexture(gl, { width, height, internalFormat = 'RGBA32F', data = null }) {
  const tex = gl.createTexture();
  const t = { tex, width, height, internalFormat: gl[internalFormat], format: gl.RGBA, type: gl.FLOAT };
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texImage2D(gl.TEXTURE_2D, 0, t.internalFormat, width, height, 0, t.format, t.type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

// Uploads a sub-rectangle (default: the whole texture); data holds 4 floats per texel, row-major.
export function updateDataTexture(gl, t, data, { x = 0, y = 0, width = t.width, height = t.height } = {}) {
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, t.format, t.type, data);
}

export function deleteDataTexture(gl, t) {
  if (t) gl.deleteTexture(t.tex);
}

// Asynchronous readback of the bound read framebuffer through a pixel-pack buffer and a fence, so
// the CPU never stalls on the GPU. Resolves with `dst` (a typed array matching format/type).
export function readPixelsAsync(gl, x, y, width, height, format, type, dst) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, dst.byteLength, gl.STREAM_READ);
  gl.readPixels(x, y, width, height, format, type, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve, reject) => {
    const done = () => { gl.deleteSync(sync); gl.deleteBuffer(buf); };
    const poll = () => {
      const res = gl.clientWaitSync(sync, 0, 0);
      if (res === gl.WAIT_FAILED) { done(); reject(new Error('readPixelsAsync: wait failed')); return; }
      if (res === gl.TIMEOUT_EXPIRED) { setTimeout(poll, 4); return; }
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, dst);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      done();
      resolve(dst);
    };
    setTimeout(poll, 0);
  });
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
