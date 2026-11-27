// Gobble Run — Pip the turkey, redesigned to the character sheet:
// banded fan tail (orange tip → tan → dark-brown base), plump brown body
// with a cream belly, layered folded wings with cream tips, orange
// googly-eyed head, yellow beak, long red wattle, skinny yellow
// three-toed feet. All procedural Three.js primitives + one runtime
// canvas gradient for the tail-feather banding. Same rig API and
// animation as before, so main.js needs no changes.
import * as THREE from 'three';

// Character-sheet palette.
const C = {
  bodyBrown: 0x9c6b38,
  wingBrown: 0x8a5630,
  darkBrown: 0x6b3a1e,
  outline: 0x3a220e,
  orange: 0xe87e1e,
  tan: 0xd9a066,
  cream: 0xf2e3c6,
  beakYellow: 0xf2c200,
  wattleRed: 0xd42a2a,
  legYellow: 0xf5b81e,
  white: 0xffffff,
  pupil: 0x1a1a1a,
};

// Tail-feather banding, painted once at boot: orange tip (top) → tan →
// dark-brown base, with a dark outline, a centre shaft and barb strokes.
// UV v=1 is the feather tip (canvas top).
function makeTailFeatherTexture() {
  const W = 128;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Bands (canvas y=0 is the tip). Base band is a readable medium brown
  // (~70 of 256 px), not the near-black it was — the old #4a2e14 over 104 px
  // rendered black under the sunset grade.
  ctx.fillStyle = '#e87e1e';
  ctx.fillRect(0, 0, W, 78);
  ctx.fillStyle = '#d9a066';
  ctx.fillRect(0, 78, W, 108);
  ctx.fillStyle = '#6b3a1e';
  ctx.fillRect(0, 186, W, H - 186);
  // Soft blend between bands.
  const blend1 = ctx.createLinearGradient(0, 66, 0, 90);
  blend1.addColorStop(0, 'rgba(232,126,30,0)');
  blend1.addColorStop(0.5, 'rgba(217,160,102,0.55)');
  blend1.addColorStop(1, 'rgba(217,160,102,0)');
  ctx.fillStyle = blend1;
  ctx.fillRect(0, 66, W, 24);
  const blend2 = ctx.createLinearGradient(0, 174, 0, 198);
  blend2.addColorStop(0, 'rgba(217,160,102,0)');
  blend2.addColorStop(0.5, 'rgba(107,58,30,0.55)');
  blend2.addColorStop(1, 'rgba(107,58,30,0)');
  ctx.fillStyle = blend2;
  ctx.fillRect(0, 174, W, 24);
  // Barb strokes: short diagonal dashes, slightly darker than the band.
  ctx.lineWidth = 2;
  for (let y = 10; y < H - 8; y += 9) {
    const band = y < 78 ? 'rgba(160,70,10,0.5)' : y < 186 ? 'rgba(150,95,40,0.5)' : 'rgba(60,32,12,0.55)';
    ctx.strokeStyle = band;
    for (let x = 12; x < W - 12; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y + 5);
      ctx.stroke();
    }
  }
  // Centre shaft.
  ctx.strokeStyle = 'rgba(122,74,38,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, H - 4);
  ctx.lineTo(W / 2, 10);
  ctx.stroke();
  // Dark outline following the feather edge (same outline as the geometry).
  ctx.strokeStyle = '#3a220e';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(10, 250);
  ctx.quadraticCurveTo(4, 190, 8, 130);
  ctx.quadraticCurveTo(10, 70, 22, 28);
  ctx.quadraticCurveTo(34, 4, 64, 4);
  ctx.quadraticCurveTo(94, 4, 106, 28);
  ctx.quadraticCurveTo(118, 70, 120, 130);
  ctx.quadraticCurveTo(124, 190, 118, 250);
  ctx.quadraticCurveTo(64, 256, 10, 250);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// One feather: rounded-tip shape, UVs remapped to 0..1 so the canvas
// bands run along its length, tip gently curved backwards.
function makeFeatherGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.045, 0);
  s.quadraticCurveTo(-0.10, 0.18, -0.125, 0.45);
  s.quadraticCurveTo(-0.135, 0.70, -0.10, 0.88);
  s.quadraticCurveTo(-0.06, 1.0, 0, 1.0);
  s.quadraticCurveTo(0.06, 1.0, 0.10, 0.88);
  s.quadraticCurveTo(0.135, 0.70, 0.125, 0.45);
  s.quadraticCurveTo(0.10, 0.18, 0.045, 0);
  s.quadraticCurveTo(0, -0.03, -0.045, 0);
  const geo = new THREE.ShapeGeometry(s, 3);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = (x - bb.min.x) / sx;
    const v = (y - bb.min.y) / sy;
    uv.setXY(i, u, v);
    // Cup backwards: tip curls -Z, edges cup slightly too.
    pos.setZ(i, -0.10 * v * v + 0.03 * ((2 * u - 1) ** 2));
  }
  geo.computeVertexNormals();
  geo.scale(1, 0.85, 1);
  return geo;
}

function buildWing(sign, wingMat, creamMat) {
  const wing = new THREE.Group();
  // Folded wing body, hugging the flank.
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), wingMat);
  base.scale.set(0.32, 0.8, 1.05);
  wing.add(base);
  // Brown covert overlapping the wing's lower edge.
  const covert = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), wingMat);
  covert.scale.set(0.20, 0.55, 0.7);
  covert.position.set(sign * 0.06, -0.12, -0.08);
  wing.add(covert);
  // Two layered cream tips peeking out below and outside the covert: they
  // sit proud of the wing's outer face and below its bottom edge, so the
  // cream reads from the front and the side instead of hiding inside the
  // wing (the old tips were buried in the wing sphere).
  for (let k = 0; k < 2; k += 1) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), creamMat);
    tip.scale.set(0.17, 0.34, 0.44);
    tip.position.set(sign * 0.16, -0.37 - k * 0.02, -0.10 + k * 0.26);
    tip.rotation.x = -0.15 * k;
    wing.add(tip);
  }
  wing.position.set(sign * 0.52, 0.92, -0.05);
  wing.rotation.y = -sign * 0.35;
  return wing;
}

function buildLeg(sign, legMat) {
  const leg = new THREE.Group();
  leg.position.set(sign * 0.2, 0.5, 0);
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8), legMat);
  shin.position.y = -0.25;
  leg.add(shin);
  // Foot: three toes splayed forward, tips touching the ground.
  for (let k = -1; k <= 1; k += 1) {
    const toe = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 6), legMat);
    toe.rotation.set(Math.PI / 2 - 0.25, k * 0.4, 0);
    toe.position.set(k * 0.07, -0.47, 0.08);
    leg.add(toe);
  }
  return leg;
}

export function buildTurkey(textures) {
  const group = new THREE.Group();
  // Body and wings are flat colours: the old feather map (dark #6b4423
  // base) multiplied by the brown tints rendered the body near-black
  // (#1f0802) under the sunset grade. Plain C.bodyBrown / C.wingBrown.
  const bodyMat = new THREE.MeshStandardMaterial({ color: C.bodyBrown, roughness: 0.9 });
  const wingMat = new THREE.MeshStandardMaterial({ color: C.wingBrown, roughness: 0.9 });
  const darkBrownMat = new THREE.MeshStandardMaterial({ color: C.darkBrown, roughness: 0.9 });
  const creamMat = new THREE.MeshStandardMaterial({ color: C.cream, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.7 });
  const beakMat = new THREE.MeshStandardMaterial({ color: C.beakYellow, roughness: 0.6 });
  const wattleMat = new THREE.MeshStandardMaterial({ color: C.wattleRed, roughness: 0.6 });
  const legMat = new THREE.MeshStandardMaterial({ color: C.legYellow, roughness: 0.7 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.35 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: C.pupil, roughness: 0.3 });
  const featherMat = new THREE.MeshStandardMaterial({
    map: makeTailFeatherTexture(), roughness: 0.85, side: THREE.DoubleSide,
  });

  // Plump body, same centre/size as before.
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), bodyMat);
  body.scale.set(1, 0.9, 1.25);
  body.position.y = 0.85;
  group.add(body);
  // Cream belly patch on the front-bottom, riding the body so it waddles
  // with it. Local coords are pre-body-scale: world centre ≈ (0, 0.70, 0.30).
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), creamMat);
  belly.scale.set(0.85, 0.75, 0.62);
  belly.position.set(0, -0.17, 0.24);
  body.add(belly);

  // Neck: short brown column from body top-front up to the head.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.4, 10), bodyMat);
  neck.position.set(0, 1.22, 0.40);
  neck.rotation.x = 0.2;
  group.add(neck);

  // Head group: orange skull, crest tuft, googly eyes, yellow beak,
  // long red wattle, small red snood over the beak. Pivot at the skull
  // centre so steer lean tilts the whole face.
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.48);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), headMat);
  head.add(skull);
  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), headMat);
  crest.scale.set(0.24, 0.14, 0.26);
  crest.position.set(0, 0.24, -0.05);
  head.add(crest);
  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), eyeWhiteMat);
    eye.position.set(sign * 0.115, 0.11, 0.185);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pupilMat);
    // Outer-front quadrant of the eyeball, so a black sliver still reads
    // from the side instead of hiding behind the eye white.
    pupil.position.set(sign * 0.15, 0.13, 0.28);
    head.add(pupil);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.32, 10), beakMat);
  beak.rotation.x = Math.PI / 2 + 0.12;
  beak.position.set(0, -0.04, 0.30);
  head.add(beak);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), wattleMat);
  wattle.scale.set(0.9, 2.2, 0.55);
  wattle.position.set(0, -0.22, 0.26);
  head.add(wattle);
  const snood = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), wattleMat);
  snood.scale.set(1, 1.5, 0.9);
  snood.position.set(0, 0.08, 0.24);
  head.add(snood);
  group.add(head);

  // Fan tail: 9 banded feathers on an arc, centre longest, outer ones a
  // touch shorter and set slightly behind for layering. Double-sided so
  // the banding reads from the chase camera (front face) and from behind.
  const tail = new THREE.Group();
  tail.position.set(0, 0.95, -0.62);
  const featherGeo = makeFeatherGeometry();
  const tailFeathers = [];
  for (let i = 0; i < 9; i += 1) {
    const feather = new THREE.Mesh(featherGeo, featherMat);
    const angle = (i - 4) * 0.27;
    feather.position.set(Math.sin(angle) * 0.45, Math.cos(angle) * 0.42, -0.02 * Math.abs(i - 4));
    feather.rotation.z = -angle;
    feather.rotation.x = -0.20 - 0.03 * Math.abs(i - 4);
    const s = 1 - 0.05 * Math.abs(i - 4);
    feather.scale.set(s, s, s);
    tail.add(feather);
    tailFeathers.push(feather);
  }
  // Solid banded fan backing behind the feathers: same tail gradient, so
  // the fan reads as one solid banded mass from the side (no sky gaps
  // between bare blades) while the rear still shows orange → tan → brown.
  // Extruded 0.10 deep so it has a real silhouette from the side; its
  // front face sits just behind the feather bases (z -0.10) and its top
  // edge stays below the feather tips, which poke out above it.
  const fanShape = new THREE.Shape();
  fanShape.moveTo(-0.75, 0);
  fanShape.absarc(0, 0, 0.75, Math.PI, 0, true);
  fanShape.lineTo(-0.75, 0);
  const fanBackGeo = new THREE.ExtrudeGeometry(fanShape, { steps: 1, depth: 0.10, bevelEnabled: false, curveSegments: 16 });
  fanBackGeo.translate(0, 0, -0.20);
  {
    // Remap the cap UVs so the banding tracks height like the feathers
    // (v=0 brown at the base, v=1 orange at the top edge).
    const uv = fanBackGeo.attributes.uv;
    const pos = fanBackGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      uv.setXY(i, (pos.getX(i) + 0.75) / 1.5, Math.min(1, Math.max(0, (pos.getY(i) - 0.05) / 0.80)));
    }
  }
  const fanBack = new THREE.Mesh(fanBackGeo, featherMat);
  tail.add(fanBack);
  // Brown covert mound over the feather bases at the rear of the body.
  // Small and low now: the old ball (y top +0.20) covered the feather
  // bases from behind.
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), darkBrownMat);
  rump.scale.set(0.5, 0.36, 0.28);
  rump.position.set(0, -0.15, -0.04);
  tail.add(rump);
  group.add(tail);

  // Scalloped cream feather edge below the back (rear view): one
  // InstancedMesh of small flattened cream puffs hugging the body's
  // rear-bottom curve.
  const scallopGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const scallops = new THREE.InstancedMesh(scallopGeo, creamMat, 7);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(0.22, 0.16, 0.10);
    for (let i = 0; i < 7; i += 1) {
      const x = -0.33 + i * 0.11;
      const y = 0.60;
      // Rear surface of the body ellipsoid (centre y 0.85, radii
      // 0.55/0.495/0.6875), pushed 0.01 proud.
      const f = Math.sqrt(Math.max(0, 1 - ((y - 0.85) / 0.495) ** 2 - (x / 0.55) ** 2));
      const z = -0.6875 * f - 0.01;
      m.compose(new THREE.Vector3(x, y, z), q, sc);
      scallops.setMatrixAt(i, m);
    }
  }
  group.add(scallops);

  const wingL = buildWing(-1, wingMat, creamMat);
  group.add(wingL);
  const wingR = buildWing(1, wingMat, creamMat);
  group.add(wingR);

  const legL = buildLeg(-1, legMat);
  group.add(legL);
  const legR = buildLeg(1, legMat);
  group.add(legR);

  const rig = {
    group, body, head, tail, tailFeathers, wingL, wingR, legL, legR,
    // Drive the whole rig from the run clock. `air` is 1 while jumping,
    // `dash` is 1 during a dash, `flare` briefly 1 after a near-miss.
    update(runPhase, speedNorm, air, dash, flare, steerLean) {
      const waddle = Math.sin(runPhase) * 0.14;
      body.rotation.z = waddle;
      body.position.y = 0.85 + Math.abs(Math.sin(runPhase)) * 0.06 + air * 0.15;
      legL.rotation.x = Math.sin(runPhase) * 0.7 * (1 - air);
      legR.rotation.x = -Math.sin(runPhase) * 0.7 * (1 - air);
      const flap = air > 0 ? Math.sin(runPhase * 3) * 0.9 : Math.sin(runPhase) * 0.18 + dash * Math.sin(runPhase * 4) * 0.7;
      wingL.rotation.z = 0.25 + flap;
      wingR.rotation.z = -0.25 - flap;
      const spread = 1 + dash * 0.35 + flare * 0.45;
      tail.scale.set(spread, spread, 1);
      tail.rotation.x = -0.15 - dash * 0.2;
      head.rotation.y = steerLean * 0.5;
      group.rotation.z = steerLean * 0.12;
    },
  };
  return rig;
}
