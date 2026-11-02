// HDR render pipeline: scene -> bloom (dual filter) -> ACES tonemapping.

import { createProgram, createInterleavedVAO, createTarget, deleteTarget } from './gl-utils.js';
import * as S from './shaders.js';

const LAYOUT = [{ loc: 0, size: 4 }, { loc: 1, size: 4 }, { loc: 2, size: 4 }];
export const FX_MAX = 48;
const REF = { stars: 220000, glow: 6000, hii: 2600, dust: 8000, outflow: 3500 };

export class GalaxyRenderer {
  constructor(gl, hdr, galaxy, background, maxTier) {
    this.gl = gl;
    this.hdr = hdr;
    this.galaxy = galaxy;
    this.maxTier = maxTier;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    this.maxPoint = Math.min(range[1], 1024);

    this.progs = {
      star: createProgram(gl, S.STAR_VS, S.STAR_FS, 'star'),
      glow: createProgram(gl, S.SPRITE_VS, S.GLOW_FS, 'glow'),
      dust: createProgram(gl, S.SPRITE_VS, S.DUST_FS, 'dust'),
      fx: createProgram(gl, S.FX_VS, S.STAR_FS, 'fx'),
      bg: createProgram(gl, S.BG_VS, S.BG_FS, 'bg'),
      core: createProgram(gl, S.FULLSCREEN_VS, S.CORE_FS, 'core'),
      down: createProgram(gl, S.FULLSCREEN_VS, S.DOWN_FS, 'down'),
      up: createProgram(gl, S.FULLSCREEN_VS, S.UP_FS, 'up'),
      composite: createProgram(gl, S.FULLSCREEN_VS, S.COMPOSITE_FS, 'composite'),
    };

    this.starVAO = createInterleavedVAO(gl, galaxy.stars, LAYOUT);
    this.spriteVAO = createInterleavedVAO(gl, galaxy.sprites, LAYOUT);
    this.bgVAO = createInterleavedVAO(gl, background.data, LAYOUT);
    this.bgCount = background.count;

    this.fxData = new Float32Array(FX_MAX * 8);
    this.fxVAO = gl.createVertexArray();
    gl.bindVertexArray(this.fxVAO);
    this.fxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.fxData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);

    this.emptyVAO = gl.createVertexArray();
    this.scene = null;
    this.bloom = [];
    this.width = 0;
    this.height = 0;
  }

  // If the user picks a higher tier than the one it was generated for, the population is regenerated.
  replaceGalaxy(galaxy) {
    const gl = this.gl;
    for (const v of [this.starVAO, this.spriteVAO]) {
      gl.deleteBuffer(v.buffer);
      gl.deleteVertexArray(v.vao);
    }
    this.galaxy = galaxy;
    this.starVAO = createInterleavedVAO(gl, galaxy.stars, LAYOUT);
    this.spriteVAO = createInterleavedVAO(gl, galaxy.sprites, LAYOUT);
  }

  // Quality tier: draw the first N entries of each range (the buffer is shuffled).
  setTier(tier, maxCfg) {
    const g = this.galaxy;
    const frac = Math.min(1, tier.stars / maxCfg.stars);
    this.counts = {
      old: Math.round(g.oldCount * frac),
      young: Math.round(g.youngCount * frac),
      glow: Math.min(g.ranges.glow[1], tier.glow),
      hii: Math.min(g.ranges.hii[1], tier.hii),
      dust: Math.min(g.ranges.dust[1], tier.dust),
      outflow: Math.min(g.ranges.outflow[1], tier.outflow),
    };
    this.bloomLevels = tier.bloomLevels;
    // Fewer particles drawn means each one is brighter, so total surface brightness is independent of tier.
    const drawnStars = this.counts.old + this.counts.young;
    this.gains = {
      star: REF.stars / Math.max(1, drawnStars),
      glow: REF.glow / Math.max(1, this.counts.glow),
      hii: Math.sqrt(REF.hii / Math.max(1, this.counts.hii)),
      dust: Math.min(2.2, REF.dust / Math.max(1, this.counts.dust)),
      outflow: REF.outflow / Math.max(1, this.counts.outflow),
    };
    this._allocBloom();
  }

  resize(width, height, scale) {
    const w = Math.max(16, Math.round(width * scale));
    const h = Math.max(16, Math.round(height * scale));
    if (w === this.width && h === this.height && this.scene) return;
    this.width = w;
    this.height = h;
    deleteTarget(this.gl, this.scene);
    this.scene = createTarget(this.gl, w, h, this.hdr);
    this._allocBloom();
  }

  _allocBloom() {
    const gl = this.gl;
    for (const t of this.bloom) deleteTarget(gl, t);
    this.bloom = [];
    if (!this.width) return;
    let w = this.width, h = this.height;
    for (let i = 0; i < (this.bloomLevels || 5); i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      if (w < 4 || h < 4) break;
      this.bloom.push(createTarget(gl, w, h, this.hdr));
    }
  }

  get starCount() { return this.counts ? this.counts.old + this.counts.young : 0; }

  _common(p, f) {
    const gl = this.gl, u = p.uniforms;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(u.uView, false, f.view);
    gl.uniformMatrix4fv(u.uProj, false, f.proj);
    gl.uniform1f(u.uT, f.t);
    gl.uniform1f(u.uK, f.k);
    gl.uniform1f(u.uEcc, f.ecc);
    gl.uniform1f(u.uHeat, f.heat);
    gl.uniform3fv(u.uRing, f.ring);
    gl.uniform1f(u.uSF, f.sf);
    gl.uniform1f(u.uSFFrac, f.sfFrac);
    gl.uniform1f(u.uAT, f.at);
    gl.uniform1f(u.uOutflow, f.outflow);
    gl.uniform1f(u.uMaxPt, this.maxPoint);
    gl.uniform1f(u.uPx, this.height / 1080);
    gl.uniform1f(u.uPxScale, (this.height / 2) / Math.tan(f.fov / 2));
    gl.uniform1f(u.uZoom, f.zoom);
    gl.uniform3fv(u.uDiskAxis, f.diskAxis);
  }

  render(f) {
    const gl = this.gl, c = this.counts, g = this.galaxy, P = this.progs;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // 1. Background: foreground stars and distant galaxies.
    gl.useProgram(P.bg.program);
    gl.uniformMatrix4fv(P.bg.uniforms.uViewRot, false, f.viewRot);
    gl.uniformMatrix4fv(P.bg.uniforms.uProj, false, f.proj);
    gl.uniform1f(P.bg.uniforms.uPx, this.height / 1080);
    gl.uniform1f(P.bg.uniforms.uGain, f.tune.background);
    gl.uniform1f(P.bg.uniforms.uMaxPt, this.maxPoint);
    gl.bindVertexArray(this.bgVAO.vao);
    gl.drawArrays(gl.POINTS, 0, this.bgCount);

    // 2. Bulge and active galactic nucleus (AGN) (in screen space, at the projected center).
    if (f.core.visible) {
      gl.useProgram(P.core.program);
      const u = P.core.uniforms;
      gl.uniform2f(u.uCenter, f.core.x * this.width, f.core.y * this.height);
      gl.uniform1f(u.uRe, Math.max(1.5, f.core.rePx * this.height));
      gl.uniform1f(u.uCorePow, f.core.power);
      gl.uniform3fv(u.uCoreColor, f.core.color);
      gl.uniform1f(u.uAgnPow, f.core.agn);
      gl.uniform3fv(u.uAgnColor, f.core.agnColor);
      gl.uniform1f(u.uAgnSigma, Math.max(0.8, 1.4 * this.height / 1080));
      gl.bindVertexArray(this.emptyVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 3. Diffuse disk and arm light.
    this._common(P.glow, f);
    gl.uniform1f(P.glow.uniforms.uIntensity, f.tune.glow * this.gains.glow);
    gl.bindVertexArray(this.spriteVAO.vao);
    gl.drawArrays(gl.POINTS, g.ranges.glow[0], c.glow);

    // 4. Old stars (disk, bulge, halo).
    this._common(P.star, f);
    gl.uniform1f(P.star.uniforms.uGain, f.tune.oldStars * this.gains.star);
    gl.bindVertexArray(this.starVAO.vao);
    gl.drawArrays(gl.POINTS, 0, c.old);

    // 5. Young stars in the arms.
    gl.uniform1f(P.star.uniforms.uGain, f.tune.youngStars * this.gains.star);
    gl.drawArrays(gl.POINTS, g.oldCount, c.young);

    // 6. H II regions — volumetric nebulae, so they are not flattened.
    this._common(P.glow, f);
    gl.uniform3f(P.glow.uniforms.uDiskAxis, 1, 0, 1);
    gl.bindVertexArray(this.spriteVAO.vao);
    gl.uniform1f(P.glow.uniforms.uIntensity, f.tune.hii * this.gains.hii);
    gl.drawArrays(gl.POINTS, g.ranges.hii[0], c.hii);

    // 7. Dust: absorbs and reddens all disk light (young stars and H II regions also lie inside
    //    the dust layer). Seen edge-on, it forms a dark dust lane along the midplane.
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    this._common(P.dust, f);
    gl.uniform1f(P.dust.uniforms.uIntensity, f.tune.dust * this.gains.dust);
    gl.drawArrays(gl.POINTS, g.ranges.dust[0], c.dust);
    gl.blendFunc(gl.ONE, gl.ONE);

    // 8. Superwind — outside the disk plane, so the dust does not obscure it.
    if (f.outflow > 0.003) {
      this._common(P.glow, f);
      gl.uniform3f(P.glow.uniforms.uDiskAxis, 1, 0, 1);
      gl.uniform1f(P.glow.uniforms.uIntensity, f.tune.outflow * this.gains.outflow);
      gl.drawArrays(gl.POINTS, g.ranges.outflow[0], c.outflow);
    }

    // 9. Supernovae.
    if (f.fxCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, f.fxData, 0, f.fxCount * 8);
      gl.useProgram(P.fx.program);
      gl.uniformMatrix4fv(P.fx.uniforms.uView, false, f.view);
      gl.uniformMatrix4fv(P.fx.uniforms.uProj, false, f.proj);
      gl.uniform1f(P.fx.uniforms.uPx, this.height / 1080);
      gl.uniform1f(P.fx.uniforms.uMaxPt, this.maxPoint);
      gl.bindVertexArray(this.fxVAO);
      gl.drawArrays(gl.POINTS, 0, f.fxCount);
    }

    this._bloom();
    this._composite(f);
    gl.bindVertexArray(null);
  }

  _bloom() {
    const gl = this.gl, P = this.progs;
    if (!this.bloom.length) return;
    gl.bindVertexArray(this.emptyVAO);
    gl.disable(gl.BLEND);
    gl.useProgram(P.down.program);
    let src = this.scene;
    for (const dst of this.bloom) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.width, dst.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(P.down.uniforms.uSrc, 0);
      gl.uniform2f(P.down.uniforms.uTexel, 1 / src.width, 1 / src.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    // Upsampling: each level adds the next smaller one onto itself (wide PSF wings).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.up.program);
    gl.uniform1f(P.up.uniforms.uWeight, 1.0);
    for (let i = this.bloom.length - 1; i > 0; i--) {
      const s = this.bloom[i], d = this.bloom[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo);
      gl.viewport(0, 0, d.width, d.height);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform1i(P.up.uniforms.uSrc, 0);
      gl.uniform2f(P.up.uniforms.uTexel, 0.5 / s.width, 0.5 / s.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  _composite(f) {
    const gl = this.gl, P = this.progs;
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(P.composite.program);
    const u = P.composite.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom.length ? this.bloom[0].tex : this.scene.tex);
    gl.uniform1i(u.uBloom, 1);
    gl.uniform1f(u.uExposure, f.exposure);
    gl.uniform1f(u.uBloomStr, this.bloom.length ? f.bloomStrength / this.bloom.length : 0);
    gl.uniform1f(u.uTime, f.at);
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}
