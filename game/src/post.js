// Gobble Run — hand-rolled post chain. No EffectComposer, no npm deps:
// one scene render into a HalfFloat target, a half-res bloom (threshold +
// two separable 5-tap blurs), a single grade pass (ACES approx + sRGB +
// vignette + radial chromatic aberration + grain), and an FXAA pass.
// Every shader here was written for this game.
import * as THREE from 'three';
import { POST } from './config.js';

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

function quadMaterial(frag, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

function makeQuadScene(material) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, camera };
}

const BRIGHT_FRAG = 'varying vec2 vUv; uniform sampler2D tSrc; uniform float threshold;'
  + 'void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b));'
  + ' float w = smoothstep(threshold, threshold + 0.25, l); gl_FragColor = vec4(c * w, 1.0); }';

const BLUR_FRAG = 'varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 dir;'
  + 'void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;'
  + ' vec2 o1 = dir * 1.3846153846; vec2 o2 = dir * 3.2307692308;'
  + ' c += texture2D(tSrc, vUv + o1).rgb * 0.3162162162;'
  + ' c += texture2D(tSrc, vUv - o1).rgb * 0.3162162162;'
  + ' c += texture2D(tSrc, vUv + o2).rgb * 0.0702702703;'
  + ' c += texture2D(tSrc, vUv - o2).rgb * 0.0702702703;'
  + ' gl_FragColor = vec4(c, 1.0); }';

// ACES fitted approximation (Narkowicz), then sRGB encode, vignette,
// radial chromatic aberration and a whisper of grain — one pass.
const GRADE_FRAG = 'varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tBloom;'
  + 'uniform float strength; uniform float ca; uniform float grain; uniform float time;'
  + 'uniform float vigOffset; uniform float vigDark;'
  + 'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }'
  + 'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }'
  + 'void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d);'
  + ' vec2 caOff = d * ca * (1.0 + r2 * 4.0);'
  + ' vec3 c;'
  + ' c.r = texture2D(tSrc, vUv + caOff).r;'
  + ' c.g = texture2D(tSrc, vUv).g;'
  + ' c.b = texture2D(tSrc, vUv - caOff).b;'
  + ' c += texture2D(tBloom, vUv).rgb * strength;'
  + ' c = aces(c);'
  + ' c = pow(c, vec3(1.0 / 2.2));'
  + ' float vig = smoothstep(vigOffset + 0.55, vigOffset, sqrt(r2));'
  + ' c *= mix(1.0 - vigDark, 1.0, vig);'
  + ' c += (hash(vUv * 913.0 + time) - 0.5) * grain;'
  + ' gl_FragColor = vec4(c, 1.0); }';

const FXAA_FRAG = 'varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 texel;'
  + 'void main(){ vec3 c = texture2D(tSrc, vUv).rgb;'
  + ' vec3 l = texture2D(tSrc, vUv - vec2(texel.x, 0.0)).rgb;'
  + ' vec3 r = texture2D(tSrc, vUv + vec2(texel.x, 0.0)).rgb;'
  + ' vec3 u = texture2D(tSrc, vUv - vec2(0.0, texel.y)).rgb;'
  + ' vec3 d = texture2D(tSrc, vUv + vec2(0.0, texel.y)).rgb;'
  + ' float edge = abs(dot(l - r, vec3(0.299, 0.587, 0.114))) + abs(dot(u - d, vec3(0.299, 0.587, 0.114)));'
  + ' if (edge > 0.08) { c = (l + r + u + d + c * 2.0) / 6.0; }'
  + ' gl_FragColor = vec4(c, 1.0); }';

function renderTarget(width, height, halfFloat) {
  return new THREE.WebGLRenderTarget(width, height, {
    type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
}

export const PRESETS = {
  low: { bloom: false, grade: false, fxaa: false, pixelRatio: 1.0, shadow: 1024 },
  medium: { bloom: true, grade: true, fxaa: false, pixelRatio: 1.25, shadow: 2048 },
  high: { bloom: true, grade: true, fxaa: true, pixelRatio: 1.5, shadow: 2048 },
};

export class HandRolledComposer {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.presetName = 'medium';
    this.preset = PRESETS.medium;
    this.caSpike = 0;
    this._buildTargets();
    this.bright = quadMaterial(BRIGHT_FRAG, {
      tSrc: { value: null }, threshold: { value: POST.bloomThreshold },
    });
    this.blurH = quadMaterial(BLUR_FRAG, { tSrc: { value: null }, dir: { value: new THREE.Vector2(1, 0) } });
    this.blurV = quadMaterial(BLUR_FRAG, { tSrc: { value: null }, dir: { value: new THREE.Vector2(0, 1) } });
    this.grade = quadMaterial(GRADE_FRAG, {
      tSrc: { value: null }, tBloom: { value: null }, strength: { value: POST.bloomStrength },
      ca: { value: POST.caBase }, grain: { value: POST.grain }, time: { value: 0 },
      vigOffset: { value: POST.vignetteOffset }, vigDark: { value: POST.vignetteDarkness },
    });
    this.fxaa = quadMaterial(FXAA_FRAG, {
      tSrc: { value: null }, texel: { value: new THREE.Vector2(1 / width, 1 / height) },
    });
    this.brightQuad = makeQuadScene(this.bright);
    this.blurHQuad = makeQuadScene(this.blurH);
    this.blurVQuad = makeQuadScene(this.blurV);
    this.gradeQuad = makeQuadScene(this.grade);
    this.fxaaQuad = makeQuadScene(this.fxaa);
  }

  _buildTargets() {
    const w = this.width;
    const h = this.height;
    this.rtScene = renderTarget(w, h, true);
    this.rtBloomA = renderTarget(Math.max(2, w >> 1), Math.max(2, h >> 1), false);
    this.rtBloomB = renderTarget(Math.max(2, w >> 1), Math.max(2, h >> 1), false);
    this.rtGrade = renderTarget(w, h, false);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.rtScene.dispose();
    this.rtBloomA.dispose();
    this.rtBloomB.dispose();
    this.rtGrade.dispose();
    this._buildTargets();
    this.fxaa.uniforms.texel.value.set(1 / width, 1 / height);
    this.blurH.uniforms.dir.value.set(1 / (width >> 1), 0);
    this.blurV.uniforms.dir.value.set(0, 1 / (height >> 1));
  }

  setPreset(name) {
    if (!PRESETS[name]) return;
    this.presetName = name;
    this.preset = PRESETS[name];
    const pr = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio);
    this.renderer.setPixelRatio(pr);
    if (this.renderer.shadowMap) {
      const sun = this._sun;
      if (sun) sun.shadow.mapSize.set(this.preset.shadow, this.preset.shadow);
    }
  }

  bindSun(sun) {
    this._sun = sun;
  }

  hitPulse() {
    this.caSpike = 1;
  }

  render(scene, camera, time, dt) {
    const p = this.preset;
    if (!p.bloom && !p.grade && !p.fxaa) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.caSpike = Math.max(0, this.caSpike - dt * 3);
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(scene, camera);

    let bloomTex = null;
    if (p.bloom) {
      this.bright.uniforms.tSrc.value = this.rtScene.texture;
      this.renderer.setRenderTarget(this.rtBloomA);
      this.renderer.render(this.brightQuad.scene, this.brightQuad.camera);
      this.blurH.uniforms.tSrc.value = this.rtBloomA.texture;
      this.renderer.setRenderTarget(this.rtBloomB);
      this.renderer.render(this.blurHQuad.scene, this.blurHQuad.camera);
      this.blurV.uniforms.tSrc.value = this.rtBloomB.texture;
      this.renderer.setRenderTarget(this.rtBloomA);
      this.renderer.render(this.blurVQuad.scene, this.blurVQuad.camera);
      bloomTex = this.rtBloomA.texture;
    }

    const gradeTarget = p.fxaa ? this.rtGrade : null;
    this.grade.uniforms.tSrc.value = this.rtScene.texture;
    this.grade.uniforms.tBloom.value = bloomTex;
    this.grade.uniforms.ca.value = POST.caBase + (POST.caHit - POST.caBase) * this.caSpike;
    this.grade.uniforms.time.value = time;
    this.renderer.setRenderTarget(gradeTarget);
    this.renderer.render(this.gradeQuad.scene, this.gradeQuad.camera);

    if (p.fxaa) {
      this.fxaa.uniforms.tSrc.value = this.rtGrade.texture;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.fxaaQuad.scene, this.fxaaQuad.camera);
    }
  }
}
