// Gobble Run — the farm. One golden-hour scene whose dressing changes by
// stage: farmyard fences and hay, barn crates, then the kitchen oven and
// swinging carving knives, ending at the Maplewood Edge gate. Static
// dressing is instanced; gameplay obstacles are a recycled pool.
import * as THREE from 'three';
import { makeRng } from './rng.js';

const POOL = { fence: 12, hay: 12, pumpkin: 12, crate: 12, corn: 40, knife: 6, oven: 2 };

// Smoothing helper (threejs-syntax-geometries / threejs-geometry skill:
// ExtrudeGeometry with a bevel gives a box whose edges catch the light
// softly instead of a razor-sharp corner). A rounded-rectangle shape is
// extruded with bevelThickness/bevelSize, and the shape/depth are shrunk
// by the bevel first, so the outer footprint is identical to the sharp
// BoxGeometry it replaces — visual only, positions and collision bounds
// do not move. Bevel faces get smooth normals; flat caps stay flat.
function roundedBoxGeometry(w, h, d, r, bevel) {
  const hw = w / 2 - bevel;
  const hh = h / 2 - bevel;
  const cr = Math.max(0.01, Math.min(r, hw, hh));
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.absarc(hw - cr, -hh + cr, cr, -Math.PI / 2, 0, false);
  s.lineTo(hw, hh - cr);
  s.absarc(hw - cr, hh - cr, cr, 0, Math.PI / 2, false);
  s.lineTo(-hw + cr, hh);
  s.absarc(-hw + cr, hh - cr, cr, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hh + cr);
  s.absarc(-hw + cr, -hh + cr, cr, Math.PI, Math.PI * 1.5, false);
  const depth = d - bevel * 2;
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1, depth, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x5a3a7a) },
      mid: { value: new THREE.Color(0xe8734a) },
      low: { value: new THREE.Color(0xffc46b) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 low;'
      + 'void main(){ float h = normalize(vPos).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));'
      + ' gl_FragColor = vec4(c, 1.0); }',
  });
}

export function buildFarm(scene, textures) {
  const rng = makeRng(7);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.6);
  sun.position.set(-30, 26, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xff9a5c, 0x5a3a22, 1.25));
  scene.fog = new THREE.Fog(0xe8905a, 45, 170);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), skyMaterial());
  scene.add(sky);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-140, 55, -420);
  sunDisc.lookAt(0, 10, 0);
  scene.add(sunDisc);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 1150),
    new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1 }),
  );
  ground.material.map.repeat.set(8, 150);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -540);
  ground.receiveShadow = true;
  scene.add(ground);

  // Worn dirt track down the middle, and a chequered kitchen floor where
  // the farmyard ends (700 m) — one draw each, both static.
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1150),
    new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 1 }),
  );
  path.material.map.repeat.set(2, 150);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, -540);
  path.receiveShadow = true;
  scene.add(path);
  const kitchenFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 300),
    new THREE.MeshStandardMaterial({ map: textures.tile, roughness: 0.85 }),
  );
  kitchenFloor.material.map.repeat.set(3, 75);
  kitchenFloor.rotation.x = -Math.PI / 2;
  kitchenFloor.position.set(0, 0.03, -850);
  kitchenFloor.receiveShadow = true;
  scene.add(kitchenFloor);

  const dummy = new THREE.Object3D();

  function instanced(geometry, material, count, place) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i += 1) {
      place(dummy, i, rng);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  }

  const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.9 });
  const fencePost = new THREE.BoxGeometry(0.14, 1.1, 0.14);
  instanced(fencePost, woodMat, 500, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -Math.floor(i / 2) * 4;
    d.position.set(side * 5.2, 0.55, z);
    d.rotation.set(0, 0, 0);
  });
  const fenceRail = new THREE.BoxGeometry(0.08, 0.12, 4);
  instanced(fenceRail, woodMat, 500, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -Math.floor(i / 2) * 4 + 2;
    d.position.set(side * 5.2, 0.75 + (i % 4 === 0 ? 0.25 : 0), z);
    d.rotation.set(0, 0, 0);
  });

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1c, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xd96a1e, roughness: 1 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0xc23b1e, roughness: 1 });
  // Trunk and canopy placements are pure functions of the index, so each
  // tree's crown sits on its own trunk instead of a neighbour's.
  function treeSpot(i) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (8 + ((i * 37) % 13));
    const z = -((i * 53) % 1000) - 10;
    return [x, z];
  }
  instanced(new THREE.CylinderGeometry(0.25, 0.4, 3.5, 8), trunkMat, 90, (d, i) => {
    const [x, z] = treeSpot(i);
    d.position.set(x, 1.75, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });
  instanced(new THREE.SphereGeometry(2.2, 10, 8), leafMat, 50, (d, i) => {
    const [x, z] = treeSpot(i);
    d.position.set(x, 4.6, z);
    d.rotation.set(0, 0, 0);
    const s = 0.8 + ((i * 13) % 10) / 14;
    d.scale.set(s, s * 0.8, s);
  });
  instanced(new THREE.SphereGeometry(2.0, 10, 8), leafMat2, 40, (d, i) => {
    const [x, z] = treeSpot(i + 50);
    d.position.set(x, 4.2, z);
    d.rotation.set(0, 0, 0);
    const s = 0.7 + ((i * 17) % 10) / 16;
    d.scale.set(s, s * 0.8, s);
  });

  const hayMat = new THREE.MeshStandardMaterial({ map: textures.straw, roughness: 1 });
  instanced(new THREE.ConeGeometry(1.1, 1.6, 12), hayMat, 40, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    d.position.set(side * (6.5 + rng.next() * 4), 0.8, -rng.next() * 900);
    d.rotation.set(0, rng.next() * Math.PI, 0);
    d.scale.set(1, 1, 1);
  });

  // ---- The ranch (farmyard, 0–300 m): red barn, silo, windmill, water
  // trough, paddock fences, pumpkin patch, chickens and cows. All static
  // except the windmill blades; the animals are InstancedMesh, so the
  // whole yard costs a handful of draw calls. `building` is hoisted, so
  // the barn can be placed here even though it is defined just below.
  building(-13, -95, 12, 6.5, 8, 0x9a2e22, 0x5d2a1a, [[-3, 3.5], [3, 3.5]]);
  const silo = new THREE.Group();
  const siloBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 7, 20),
    new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.6, metalness: 0.3 }),
  );
  siloBody.position.y = 3.5;
  siloBody.castShadow = true;
  silo.add(siloBody);
  const siloCap = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 1.6, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.8 }),
  );
  siloCap.position.y = 7.8;
  silo.add(siloCap);
  silo.position.set(-17.5, 0, -128);
  silo.matrixAutoUpdate = false;
  silo.updateMatrix();
  scene.add(silo);
  // Windmill on the right; its two crossed blades turn in update().
  const mill = new THREE.Group();
  const millTower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.5, 9, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.9 }),
  );
  millTower.position.y = 4.5;
  millTower.castShadow = true;
  mill.add(millTower);
  const millCap = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 1.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.9 }),
  );
  millCap.position.y = 9.6;
  mill.add(millCap);
  const millBlades = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  millBlades.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.12), bladeMat));
  millBlades.add(new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 0.12), bladeMat));
  millBlades.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), bladeMat));
  millBlades.position.set(0, 8.2, 1.35);
  mill.add(millBlades);
  mill.position.set(15, 0, -190);
  scene.add(mill);
  // Water trough on the left: beveled wooden rim with a blue water plane.
  const trough = new THREE.Group();
  const troughBox = new THREE.Mesh(roundedBoxGeometry(2.4, 0.7, 1.1, 0.12, 0.08), woodMat);
  troughBox.position.y = 0.35;
  troughBox.castShadow = true;
  trough.add(troughBox);
  const troughWater = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x4a90c2, roughness: 0.2, metalness: 0.1 }),
  );
  troughWater.rotation.x = -Math.PI / 2;
  troughWater.position.y = 0.62;
  trough.add(troughWater);
  trough.position.set(-7.5, 0, -60);
  scene.add(trough);
  // Paddock pen on the right, x 8–18, z -60..-100: posts + one rail high.
  instanced(new THREE.BoxGeometry(0.14, 1.1, 0.14), woodMat, 36, (d, i) => {
    const edge = Math.floor(i / 9);
    const k = i % 9;
    if (edge === 0) d.position.set(8 + k * 1.25, 0.55, -60);
    else if (edge === 1) d.position.set(8 + k * 1.25, 0.55, -100);
    else if (edge === 2) d.position.set(8, 0.55, -60 - k * 5);
    else d.position.set(18, 0.55, -60 - k * 5);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });
  instanced(new THREE.BoxGeometry(0.08, 0.12, 4), woodMat, 26, (d, i) => {
    if (i < 3) {
      d.position.set(9.5 + i * 3.4, 0.75, -60);
      d.rotation.set(0, Math.PI / 2, 0);
    } else if (i < 6) {
      d.position.set(9.5 + (i - 3) * 3.4, 0.75, -100);
      d.rotation.set(0, Math.PI / 2, 0);
    } else if (i < 16) {
      d.position.set(8, 0.75, -62 - (i - 6) * 4);
      d.rotation.set(0, 0, 0);
    } else {
      d.position.set(18, 0.75, -62 - (i - 16) * 4);
      d.rotation.set(0, 0, 0);
    }
    d.scale.set(1, 1, 1);
  });
  // Pumpkin patch, farmyard only.
  const patchMat = new THREE.MeshStandardMaterial({ color: 0xe8721e, roughness: 0.8 });
  instanced(new THREE.SphereGeometry(0.7, 12, 10), patchMat, 24, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (6.5 + ((i * 29) % 70) / 10);
    const z = -10 - ((i * 47) % 280);
    d.position.set(x, 0.55, z);
    const s = 0.8 + ((i * 13) % 10) / 20;
    d.scale.set(s, s * 0.8, s);
    d.rotation.set(0, 0, 0);
  });
  // Chickens: white bodies + heads, pecking around the farmyard.
  const chickMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 });
  function chickSpot(i) {
    const side = i % 2 === 0 ? -1 : 1;
    return [side * (6 + ((i * 31) % 60) / 10), -15 - ((i * 43) % 260)];
  }
  instanced(new THREE.SphereGeometry(0.24, 10, 8), chickMat, 8, (d, i) => {
    const [x, z] = chickSpot(i);
    d.position.set(x, 0.24, z);
    d.scale.set(1, 0.9, 1.25);
    d.rotation.set(0, 0, 0);
  });
  instanced(new THREE.SphereGeometry(0.13, 8, 8), chickMat, 8, (d, i) => {
    const [x, z] = chickSpot(i);
    d.position.set(x, 0.45, z + 0.24);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  // Cows: pale capsule bodies (same 1.7 m length, 0.9 m height as the old
  // boxes), dark ellipsoid heads, standing side-on to the track — now
  // with legs, hooves, ears, small horns, tails, udders, pink muzzles
  // and black Holstein patches. Spots, body size and orientation are
  // unchanged; every extra part is placed off cowSpot(i).
  const cowMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.95 });
  const cowHeadMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.95 });
  const cowBlackMat = new THREE.MeshStandardMaterial({ color: 0x1e1a18, roughness: 0.95 });
  const cowPinkMat = new THREE.MeshStandardMaterial({ color: 0xd9a08a, roughness: 0.9 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  function cowSpot(i) {
    const side = i % 2 === 0 ? -1 : 1;
    return [side * (8 + ((i * 23) % 50) / 10), -40 - ((i * 61) % 220)];
  }
  const cowBodyGeo = new THREE.CapsuleGeometry(0.45, 0.8, 4, 12);
  cowBodyGeo.rotateZ(Math.PI / 2);
  instanced(cowBodyGeo, cowMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    // Body centre 0.55, not 0.75: capsule radius 0.45 puts the belly
    // 0.10 m off the ground instead of floating 0.30 m up.
    d.position.set(x, 0.55, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  const cowHeadGeo = new THREE.SphereGeometry(0.5, 12, 10);
  cowHeadGeo.scale(0.55, 0.55, 0.6);
  instanced(cowHeadGeo, cowHeadMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    d.position.set(x + 0.95, 0.9, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  // Legs: 4 per cow, front pair under the head end (+X), rear pair under
  // the tail end (-X). Hooves are dark caps at the bottom of each leg.
  instanced(new THREE.CylinderGeometry(0.09, 0.08, 0.4, 8), cowMat, 16, (d, i) => {
    const [x, z] = cowSpot(Math.floor(i / 4));
    const leg = i % 4;
    d.position.set(x + (leg < 2 ? 0.55 : -0.55), 0.20, z + (leg % 2 === 0 ? 0.22 : -0.22));
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  instanced(new THREE.CylinderGeometry(0.10, 0.10, 0.08, 8), cowBlackMat, 16, (d, i) => {
    const [x, z] = cowSpot(Math.floor(i / 4));
    const leg = i % 4;
    d.position.set(x + (leg < 2 ? 0.55 : -0.55), 0.04, z + (leg % 2 === 0 ? 0.22 : -0.22));
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  // Ears: flat pale flaps sticking out sideways from the head.
  instanced(new THREE.SphereGeometry(0.17, 10, 8), cowMat, 8, (d, i) => {
    const [x, z] = cowSpot(Math.floor(i / 2));
    const s = i % 2 === 0 ? 1 : -1;
    d.position.set(x + 0.85, 1.02, z + s * 0.30);
    d.scale.set(1.1, 0.3, 1.4);
    d.rotation.set(s * 0.5, 0, 0);
  });
  // Horns: small cream cones tilting up and out from the top of the head.
  instanced(new THREE.ConeGeometry(0.055, 0.24, 8), hornMat, 8, (d, i) => {
    const [x, z] = cowSpot(Math.floor(i / 2));
    const s = i % 2 === 0 ? 1 : -1;
    d.position.set(x + 0.88, 1.20, z + s * 0.14);
    d.scale.set(1, 1, 1);
    d.rotation.set(s * 0.5, 0, -0.2);
  });
  // Tails: thin pale switch hanging at the rear, dark tuft at the tip.
  instanced(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 6), cowMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    d.position.set(x - 0.88, 0.45, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0.15);
  });
  instanced(new THREE.SphereGeometry(0.09, 8, 8), cowBlackMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    d.position.set(x - 0.92, 0.18, z);
    d.scale.set(1, 1.3, 1);
    d.rotation.set(0, 0, 0);
  });
  // Udder: pink flattened sphere under the belly, rear of centre.
  instanced(new THREE.SphereGeometry(0.18, 10, 8), cowPinkMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    d.position.set(x - 0.05, 0.16, z);
    d.scale.set(1.5, 0.55, 0.9);
    d.rotation.set(0, 0, 0);
  });
  // Muzzle: pink flattened sphere on the front of the dark head, with
  // two tiny nostrils.
  instanced(new THREE.SphereGeometry(0.20, 10, 8), cowPinkMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    d.position.set(x + 1.22, 0.82, z);
    d.scale.set(0.75, 0.6, 1.05);
    d.rotation.set(0, 0, 0);
  });
  instanced(new THREE.SphereGeometry(0.03, 6, 6), cowBlackMat, 8, (d, i) => {
    const [x, z] = cowSpot(Math.floor(i / 2));
    const s = i % 2 === 0 ? 1 : -1;
    d.position.set(x + 1.36, 0.84, z + s * 0.07);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  // Holstein patches: flattened black spheres hugging one flank each.
  instanced(new THREE.SphereGeometry(0.30, 10, 8), cowBlackMat, 4, (d, i) => {
    const [x, z] = cowSpot(i);
    const s = i % 2 === 0 ? 1 : -1;
    const dx = i % 2 === 0 ? -0.25 : 0.3;
    d.position.set(x + dx, 0.62, z + s * 0.38);
    d.scale.set(1.3, 0.85, 0.3);
    d.rotation.set(0, 0, 0);
  });

  // Goats: 3 of them, smaller and slimmer than the cows, grazing at the
  // roadside in the farmyard (x +/-8-13, z -70/-190/-250 — clear of the
  // track, the ovens/kitchen, the cows and the chickens). Same instanced
  // pattern as the cows: capsule body, head with beard, curved horns,
  // long drooping ears, thin legs, upright tail.
  // Goat spots (x, z, yaw, headY): A left by the trough, B right
  // mid-yard, C left near the farmyard's far end, head down grazing.
  const goatSpots = [
    { x: -10.5, z: -70, yaw: 0.5, headY: 0.68 },
    { x: 12.5, z: -190, yaw: -0.6, headY: 0.68 },
    { x: -11, z: -250, yaw: 0.9, headY: 0.42 },
  ];
  const goatMat = new THREE.MeshStandardMaterial({ color: 0xcbb59a, roughness: 0.95 });
  const goatHeadMat = new THREE.MeshStandardMaterial({ color: 0xb59a78, roughness: 0.95 });
  const goatBeardMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  function goatLocal(i, lx, ly, lz) {
    const g = goatSpots[i];
    const c = Math.cos(g.yaw);
    const s = Math.sin(g.yaw);
    return [g.x + lx * c + lz * s, ly, g.z - lx * s + lz * c];
  }
  const goatBodyGeo = new THREE.CapsuleGeometry(0.22, 0.5, 4, 10);
  goatBodyGeo.rotateZ(Math.PI / 2);
  instanced(goatBodyGeo, goatMat, 3, (d, i) => {
    const g = goatSpots[i];
    d.position.set(g.x, 0.45, g.z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, g.yaw, 0);
  });
  instanced(new THREE.SphereGeometry(0.17, 12, 10), goatHeadMat, 3, (d, i) => {
    const [x, y, z] = goatLocal(i, 0.55, goatSpots[i].headY, 0);
    d.position.set(x, y, z);
    d.scale.set(1, 0.95, 0.9);
    d.rotation.set(0, goatSpots[i].yaw, 0);
  });
  // Beard: small dark cone under the chin, pointing down.
  instanced(new THREE.ConeGeometry(0.06, 0.18, 8), goatBeardMat, 3, (d, i) => {
    const [x, , z] = goatLocal(i, 0.58, 0, 0);
    d.position.set(x, goatSpots[i].headY - 0.16, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(Math.PI, 0, 0);
  });
  // Horns: curved cream arcs sweeping back from the top of the head.
  const goatHornGeo = new THREE.TorusGeometry(0.14, 0.03, 6, 10, Math.PI * 0.9);
  instanced(goatHornGeo, hornMat, 6, (d, i) => {
    const gi = Math.floor(i / 2);
    const s = i % 2 === 0 ? 1 : -1;
    const [x, , z] = goatLocal(gi, 0.48, 0, s * 0.08);
    d.position.set(x, goatSpots[gi].headY + 0.14, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(s * 0.5, goatSpots[gi].yaw, 0.4);
  });
  // Ears: long capsules drooping out and down from the head.
  instanced(new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), goatHeadMat, 6, (d, i) => {
    const gi = Math.floor(i / 2);
    const s = i % 2 === 0 ? 1 : -1;
    const [x, , z] = goatLocal(gi, 0.48, 0, s * 0.16);
    d.position.set(x, goatSpots[gi].headY - 0.06, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(s * 1.1, goatSpots[gi].yaw, 0.2);
  });
  // Thin legs, 4 per goat.
  instanced(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 6), goatHeadMat, 12, (d, i) => {
    const gi = Math.floor(i / 4);
    const leg = i % 4;
    const [x, , z] = goatLocal(gi, leg < 2 ? 0.30 : -0.30, 0, leg % 2 === 0 ? 0.13 : -0.13);
    d.position.set(x, 0.21, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  // Tail: small cone sticking up at the rear.
  instanced(new THREE.ConeGeometry(0.06, 0.18, 8), goatMat, 3, (d, i) => {
    const [x, , z] = goatLocal(i, -0.52, 0, 0);
    d.position.set(x, 0.68, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, goatSpots[i].yaw, 0.8);
  });

  // Buildings: farmhouse near the start, barn mid-track, oven in the kitchen.
  function building(x, z, w, h, dpt, wallColor, roofColor, windows) {
    const g = new THREE.Group();
    // Walls: beveled rounded box instead of a sharp BoxGeometry — same
    // outer footprint, soft edges. The pyramid roof keeps its shape.
    // Bevel 0.35 (was 0.12, ~1% of an 8–12 m wall and invisible at
    // gameplay distance); now ~3–4% and the corners catch the light.
    const walls = new THREE.Mesh(roundedBoxGeometry(w, h, dpt, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95 }));
    walls.position.y = h / 2;
    walls.castShadow = true;
    g.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dpt) * 0.75, h * 0.6, 4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.95 }));
    roof.position.y = h + h * 0.3;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    windows.forEach(([wx, wy]) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), winMat);
      win.position.set(wx, wy, dpt / 2 + 0.01);
      g.add(win);
    });
    g.position.set(x, 0, z);
    g.matrixAutoUpdate = false;
    g.updateMatrix();
    scene.add(g);
    return g;
  }
  building(-11, -30, 8, 4.5, 6, 0xe8dcc0, 0x8a3b2a, [[-2, 2.5], [2, 2.5]]);
  building(12, -330, 10, 5.5, 7, 0x9a4a2e, 0x5d2a1a, [[-2.5, 3], [2.5, 3]]);

  // Kitchen ovens: beveled black boxes with a glowing door and a chimney.
  const ovenLight = new THREE.PointLight(0xff6a1e, 30, 25, 1.6);
  ovenLight.position.set(0, 2.5, -760);
  scene.add(ovenLight);
  const ovenDoorMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e });
  const ovenBodyGeo = roundedBoxGeometry(5, 4, 3, 0.25, 0.15);
  [-750, -880].forEach((z) => {
    const oven = new THREE.Group();
    const body = new THREE.Mesh(ovenBodyGeo, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.4 }));
    body.position.y = 2;
    body.castShadow = true;
    oven.add(body);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), ovenDoorMat);
    door.position.set(0, 1.8, 1.51);
    oven.add(door);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 10), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }));
    chimney.position.set(1.5, 5.5, 0);
    oven.add(chimney);
    oven.position.set(7.5, 0, z);
    oven.matrixAutoUpdate = false;
    oven.updateMatrix();
    scene.add(oven);
  });

  // Barn-stage clutter: two-high beveled crate stacks and bulging lathe
  // barrels along both sides of the track (300–700 m), and beveled
  // kitchen counters (700–1000 m). Instanced, so the whole lot is three
  // draw calls.
  instanced(roundedBoxGeometry(1.1, 1.1, 1.1, 0.12, 0.06), woodMat, 30, (d, i) => {
    const s = Math.floor(i / 2);
    const side = s % 2 === 0 ? -1 : 1;
    const x = side * (6.5 + ((s * 17) % 30) / 10);
    const z = -310 - ((s * 37) % 380);
    d.position.set(x, 0.55 + (i % 2) * 1.1, z);
    d.scale.set(1, 1, 1);
    d.rotation.set(0, ((s * 19) % 10) / 10 * 0.6, 0);
  });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
  // A real barrel bulges at the middle: lathe profile, same 1.1 m height.
  const barrelProfile = [
    new THREE.Vector2(0.0, -0.55), new THREE.Vector2(0.48, -0.55),
    new THREE.Vector2(0.56, -0.35), new THREE.Vector2(0.63, 0),
    new THREE.Vector2(0.56, 0.35), new THREE.Vector2(0.48, 0.55),
    new THREE.Vector2(0.0, 0.55),
  ];
  instanced(new THREE.LatheGeometry(barrelProfile, 12), barrelMat, 20, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    d.position.set(side * (6.5 + ((i * 23) % 40) / 10), 0.55, -320 - ((i * 53) % 370));
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });
  // Barrel hoops: two dark metal bands per barrel at ±0.35 m, where the
  // lathe radius is 0.56 — same placement as the barrels, one extra draw
  // call, ~4.8k tris. The barrels read as bound staves, not plain vases.
  const hoopMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 });
  instanced(new THREE.TorusGeometry(0.57, 0.03, 5, 12), hoopMat, 40, (d, i) => {
    const bi = Math.floor(i / 2);
    const side = bi % 2 === 0 ? -1 : 1;
    d.position.set(side * (6.5 + ((bi * 23) % 40) / 10), 0.55 + (i % 2 === 0 ? -0.35 : 0.35), -320 - ((bi * 53) % 370));
    d.scale.set(1, 1, 1);
    d.rotation.set(Math.PI / 2, 0, 0);
  });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.85 });
  instanced(roundedBoxGeometry(2.4, 1.0, 1.0, 0.12, 0.08), counterMat, 16, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    d.position.set(side * 6.8, 0.5, -710 - ((i * 41) % 280));
    d.scale.set(1, 1, 1);
    d.rotation.set(0, 0, 0);
  });

  // Maplewood Edge gate at the finish.
  const gate = new THREE.Group();
  const gateMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.9 });
  [-4.5, 4.5].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 10), gateMat);
    post.position.set(x, 3.5, 0);
    gate.add(post);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 0.2), new THREE.MeshStandardMaterial({ map: textures.sign, roughness: 0.9 }));
  board.position.set(0, 6.2, 0);
  gate.add(board);
  gate.position.set(0, 0, -1000);
  scene.add(gate);

  // ---- Obstacle pool: recycled meshes, one shared geometry/material each.
  // Sharp boxes are beveled the same way as the static props; cones get
  // more radial segments. Same sizes and sync positions as before.
  const geoFence = roundedBoxGeometry(2.4, 1.0, 0.25, 0.08, 0.04);
  const geoHay = new THREE.ConeGeometry(1.0, 1.5, 12);
  const geoPumpkin = new THREE.SphereGeometry(0.7, 12, 10);
  const geoCrate = roundedBoxGeometry(1.2, 1.2, 1.2, 0.12, 0.06);
  // Turkey-face bonus pickup (replaces the corn cob): a painted face disc
  // — same palette as turkey.js (orange head, yellow beak, red wattle /
  // snood, googly eyes) — plus a bright gold ring that blooms slightly,
  // so it reads as a pickup from the chase camera. Two meshes per pool
  // slot, the same draw-call order as the old cone. The disc always faces
  // +Z (toward the player/camera); hitbox and spawn are untouched —
  // world.js still calls it kind 'corn'. Same technique as the tail
  // feather texture in turkey.js: one CanvasTexture painted at boot.
  function makeTurkeyFaceTexture() {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S / 2;
    const cy = S / 2;
    // Orange head, soft radial shade (lighter centre).
    const grad = ctx.createRadialGradient(cx, cy - 10, 20, cx, cy, 128);
    grad.addColorStop(0, '#f0963a');
    grad.addColorStop(1, '#e87e1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    // Gold rim just inside the disc edge.
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.stroke();
    // Crest tuft on top.
    ctx.fillStyle = '#d96a1e';
    for (const dx of [-28, 0, 28]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx, 34, 16, 22, dx * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    // Googly eyes: white + pupils pushed out/down (turkey.js style).
    for (const sign of [-1, 1]) {
      const ex = cx + sign * 52;
      const ey = cy - 38;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(ex + sign * 10, ey + 8, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + sign * 10 - 4, ey + 8 - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Snood: small red drop over the beak.
    ctx.fillStyle = '#d42a2a';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, 13, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beak: yellow triangle pointing down.
    ctx.fillStyle = '#f2c200';
    ctx.beginPath();
    ctx.moveTo(cx - 38, cy + 8);
    ctx.lineTo(cx + 38, cy + 8);
    ctx.lineTo(cx, cy + 72);
    ctx.closePath();
    ctx.fill();
    // Wattle: red drop under the beak.
    ctx.fillStyle = '#d42a2a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 84, 20, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  const faceTex = makeTurkeyFaceTexture();
  const geoFace = new THREE.CircleGeometry(0.32, 28);
  const matFace = new THREE.MeshStandardMaterial({
    map: faceTex, roughness: 0.7,
    emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.35,
  });
  const geoFaceRing = new THREE.TorusGeometry(0.34, 0.025, 8, 32);
  const matFaceRing = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  function makeTurkeyFacePickup() {
    const g = new THREE.Group();
    const face = new THREE.Mesh(geoFace, matFace);
    face.scale.set(1, 1.25, 1);
    g.add(face);
    const ring = new THREE.Mesh(geoFaceRing, matFaceRing);
    ring.scale.set(1, 1.25, 1);
    g.add(ring);
    return g;
  }
  const matPumpkin = new THREE.MeshStandardMaterial({ color: 0xe8721e, roughness: 0.8 });
  const matBlade = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 });
  const matHandle = new THREE.MeshStandardMaterial({ color: 0x4a2c12, roughness: 0.9 });
  const matFlame = new THREE.MeshBasicMaterial({ color: 0xff8a1e });
  const matFlameCore = new THREE.MeshBasicMaterial({ color: 0xffd23e });

  function makePool(kind, count, build) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = build();
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      list.push({ mesh, entity: null });
    }
    return list;
  }
  const pools = {
    fence: makePool('fence', POOL.fence, () => new THREE.Mesh(geoFence, woodMat)),
    hay: makePool('hay', POOL.hay, () => new THREE.Mesh(geoHay, hayMat)),
    pumpkin: makePool('pumpkin', POOL.pumpkin, () => {
      const m = new THREE.Mesh(geoPumpkin, matPumpkin);
      m.scale.set(1, 0.85, 1);
      return m;
    }),
    crate: makePool('crate', POOL.crate, () => new THREE.Mesh(geoCrate, woodMat)),
    corn: makePool('corn', POOL.corn, makeTurkeyFacePickup),
    knife: makePool('knife', POOL.knife, () => {
      const g = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.7), matBlade);
      blade.position.y = -1.1;
      g.add(blade);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.3), matHandle);
      handle.position.y = 0.2;
      g.add(handle);
      return g;
    }),
    // Oven blast: a ground marker (the telegraph) plus two flame cones.
    // Basic materials, so the blast reads as glowing through the bloom
    // pass without a second point light. Marker material is cloned per
    // slot so the warning pulse is independent.
    oven: makePool('oven', POOL.oven, () => {
      const g = new THREE.Group();
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 3.4),
        new THREE.MeshBasicMaterial({ color: 0xff6a1e, transparent: true, opacity: 0.16 }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.06;
      g.add(marker);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 10), matFlame);
      flame.position.y = 1.1;
      flame.visible = false;
      g.add(flame);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 8), matFlameCore);
      core.position.y = 0.85;
      core.visible = false;
      g.add(core);
      g.userData.marker = marker;
      g.userData.flame = flame;
      g.userData.core = core;
      return g;
    }),
  };

  let lastShadowZ = -100;
  // Dev warning for a pool overflow (F-C): a live entity with no free
  // slot would otherwise render nothing while still colliding. Once per
  // kind per session, so a sustained overflow does not spam the console.
  const poolWarned = {};

  return {
    sun,
    ovenLight,
    // Position pooled meshes from the world's live entity list.
    sync(world) {
      const byKind = { fence: 0, hay: 0, pumpkin: 0, crate: 0, corn: 0, knife: 0, oven: 0 };
      this._ovenWarn = false;
      for (const e of world.entities) {
        if (!e.active) continue;
        const pool = pools[e.kind];
        if (!pool) continue;
        const slot = pool[byKind[e.kind]];
        if (!slot) {
          if (!poolWarned[e.kind]) {
            poolWarned[e.kind] = true;
            console.warn('[gobble] pool overflow: no free slot for', e.kind, '- raise POOL.' + e.kind);
          }
          continue;
        }
        byKind[e.kind] += 1;
        slot.mesh.visible = true;
        slot.mesh.position.set(e.lane, e.y || 0, -e.z);
        if (e.kind === 'corn') {
          // Face stays toward the chase camera (+Z): gentle sway instead
          // of the old full spin (a spinning face would show its back
          // half the time). Bobbing kept.
          slot.mesh.rotation.y = Math.sin(world.time * 1.2 + e.z) * 0.35;
          slot.mesh.position.y = 1.0 + Math.sin(world.time * 2 + e.z) * 0.15;
        } else if (e.kind === 'knife') {
          slot.mesh.position.y = 3.4;
          // Turn the blade ~0.9 rad so its broad face catches the chase
          // camera instead of reading edge-on as a thin sliver. Visual
          // only: knife collision lives in world.js (lane/z) and is untouched.
          slot.mesh.rotation.y = 0.9;
          slot.mesh.rotation.x = Math.sin(world.time * 2.2 + e.phase) * 0.9;
        } else if (e.kind === 'hay') {
          slot.mesh.position.y = 0.75;
        } else if (e.kind === 'pumpkin') {
          slot.mesh.position.y = 0.6;
        } else if (e.kind === 'crate') {
          slot.mesh.position.y = 0.6;
        } else if (e.kind === 'fence') {
          slot.mesh.position.y = 0.5;
        } else if (e.kind === 'oven') {
          // Oven blast telegraph: idle shows a faint pad on the track,
          // warn pulses it (the door flare + HUD + sound fire with it),
          // hot shows the flames. Done hides the whole group.
          slot.mesh.position.y = 0;
          const marker = slot.mesh.userData.marker;
          const flame = slot.mesh.userData.flame;
          const core = slot.mesh.userData.core;
          if (e.ovenPhase === 'warn') {
            marker.visible = true;
            marker.material.opacity = 0.45 + 0.25 * Math.sin(world.time * 10);
            flame.visible = false;
            core.visible = false;
            this._ovenWarn = true;
          } else if (e.ovenPhase === 'hot') {
            marker.visible = true;
            marker.material.opacity = 0.85;
            flame.visible = true;
            core.visible = true;
            const flick = 1 + 0.12 * Math.sin(world.time * 31);
            flame.scale.set(flick, 1 + 0.2 * Math.sin(world.time * 27), flick);
            core.scale.set(1, 1 + 0.25 * Math.sin(world.time * 33), 1);
            this._ovenWarn = true;
          } else if (e.ovenPhase === 'idle') {
            marker.visible = true;
            marker.material.opacity = 0.16;
            flame.visible = false;
            core.visible = false;
          } else {
            slot.mesh.visible = false;
          }
        }
      }
      for (const kind of Object.keys(pools)) {
        for (let i = byKind[kind]; i < pools[kind].length; i += 1) {
          pools[kind][i].mesh.visible = false;
        }
      }
    },
    update(dt, playerZ, time) {
      sky.position.z = -playerZ;
      sky.position.x = 0;
      sun.position.set(-30, 26, -playerZ - 20);
      sun.target.position.set(0, 0, -playerZ);
      sun.target.updateMatrixWorld();
      millBlades.rotation.z += dt * 0.9;
      // While an oven warns or burns, its static doors flare brighter and
      // the kitchen light runs hotter — the same telegraph, seen from afar.
      const flare = this._ovenWarn ? 1 : 0;
      ovenLight.intensity = (flare ? 48 : 24) + Math.sin(time * 3) * 6;
      ovenDoorMat.color.setHex(flare ? 0xffc21e : 0xff7a1e);
      if (playerZ - lastShadowZ > 4) {
        lastShadowZ = playerZ;
        return true;
      }
      return false;
    },
  };
}
