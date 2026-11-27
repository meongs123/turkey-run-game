// Gobble Run — the farm. One golden-hour scene whose dressing changes by
// stage: farmyard fences and hay, barn crates, then the kitchen oven and
// swinging carving knives, ending at the Maplewood Edge gate. Static
// dressing is instanced; gameplay obstacles are a recycled pool.
import * as THREE from 'three';
import { makeRng } from './rng.js';

const POOL = { fence: 8, hay: 6, pumpkin: 6, crate: 6, corn: 24, knife: 4 };

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
  instanced(new THREE.CylinderGeometry(0.25, 0.4, 3.5, 8), trunkMat, 70, (d, i) => {
    const [x, z] = treeSpot(i);
    d.position.set(x, 1.75, z);
    d.rotation.set(0, 0, 0);
  });
  instanced(new THREE.SphereGeometry(2.2, 10, 8), leafMat, 40, (d, i) => {
    const [x, z] = treeSpot(i);
    d.position.set(x, 4.6, z);
    d.rotation.set(0, 0, 0);
    const s = 0.8 + ((i * 13) % 10) / 14;
    d.scale.set(s, s * 0.8, s);
  });
  instanced(new THREE.SphereGeometry(2.0, 10, 8), leafMat2, 30, (d, i) => {
    const [x, z] = treeSpot(i + 40);
    d.position.set(x, 4.2, z);
    d.rotation.set(0, 0, 0);
    const s = 0.7 + ((i * 17) % 10) / 16;
    d.scale.set(s, s * 0.8, s);
  });

  const hayMat = new THREE.MeshStandardMaterial({ map: textures.straw, roughness: 1 });
  instanced(new THREE.ConeGeometry(1.1, 1.6, 10), hayMat, 24, (d, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    d.position.set(side * (6.5 + rng.next() * 4), 0.8, -rng.next() * 900);
    d.rotation.set(0, rng.next() * Math.PI, 0);
  });

  // Buildings: farmhouse near the start, barn mid-track, oven in the kitchen.
  function building(x, z, w, h, dpt, wallColor, roofColor, windows) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95 }));
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

  // Kitchen ovens: black boxes with a glowing door and a chimney.
  const ovenLight = new THREE.PointLight(0xff6a1e, 30, 25, 1.6);
  ovenLight.position.set(0, 2.5, -760);
  scene.add(ovenLight);
  const ovenDoorMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e });
  [-750, -880].forEach((z) => {
    const oven = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 3), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.4 }));
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
  const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshBasicMaterial({ color: 0xa8e06a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  gateGlow.position.set(0, 4, -1);
  gate.add(gateGlow);
  gate.position.set(0, 0, -1000);
  scene.add(gate);

  // ---- Obstacle pool: recycled meshes, one shared geometry/material each.
  const geoFence = new THREE.BoxGeometry(2.4, 1.0, 0.25);
  const geoHay = new THREE.ConeGeometry(1.0, 1.5, 10);
  const geoPumpkin = new THREE.SphereGeometry(0.7, 12, 10);
  const geoCrate = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const geoCorn = new THREE.ConeGeometry(0.22, 0.8, 8);
  const matPumpkin = new THREE.MeshStandardMaterial({ color: 0xe8721e, roughness: 0.8 });
  const matCorn = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  const matBlade = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 });
  const matHandle = new THREE.MeshStandardMaterial({ color: 0x4a2c12, roughness: 0.9 });

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
    corn: makePool('corn', POOL.corn, () => new THREE.Mesh(geoCorn, matCorn)),
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
  };

  let lastShadowZ = -100;

  return {
    sun,
    ovenLight,
    // Position pooled meshes from the world's live entity list.
    sync(world) {
      const byKind = { fence: 0, hay: 0, pumpkin: 0, crate: 0, corn: 0, knife: 0 };
      for (const e of world.entities) {
        if (!e.active) continue;
        const pool = pools[e.kind];
        if (!pool) continue;
        const slot = pool[byKind[e.kind]];
        if (!slot) continue;
        byKind[e.kind] += 1;
        slot.mesh.visible = true;
        slot.mesh.position.set(e.lane, e.y || 0, -e.z);
        if (e.kind === 'corn') {
          slot.mesh.rotation.y = world.time * 1.5 + e.z;
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
      ovenLight.intensity = 24 + Math.sin(time * 3) * 6;
      if (playerZ - lastShadowZ > 4) {
        lastShadowZ = playerZ;
        return true;
      }
      return false;
    },
  };
}
