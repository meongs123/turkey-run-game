// Gobble Run — Pip the turkey. A rig of primitives: ellipsoid body,
// fanned tail, flapping wings, orange legs. All motion derives from one
// run phase clock, so the waddle is deterministic.
import * as THREE from 'three';

export function buildTurkey(textures) {
  const group = new THREE.Group();
  const brown = new THREE.MeshStandardMaterial({ map: textures.feather, color: 0x8a5a30, roughness: 0.9 });
  const darkBrown = new THREE.MeshStandardMaterial({ color: 0x5d3a1c, roughness: 0.9 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe07b1f, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc22e2e, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), brown);
  body.scale.set(1, 0.9, 1.25);
  body.position.y = 0.85;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), darkBrown);
  head.position.set(0, 1.42, 0.48);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.4, 0.78);
  group.add(beak);

  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), red);
  wattle.scale.set(1, 1.6, 0.6);
  wattle.position.set(0, 1.28, 0.72);
  group.add(wattle);

  const tail = new THREE.Group();
  tail.position.set(0, 0.95, -0.62);
  const tailFeathers = [];
  for (let i = 0; i < 7; i += 1) {
    const feather = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.85), new THREE.MeshStandardMaterial({
      map: textures.feather, color: 0x9a6a35, roughness: 0.9, side: THREE.DoubleSide,
    }));
    const angle = (i - 3) * 0.32;
    feather.position.set(Math.sin(angle) * 0.5, Math.cos(angle) * 0.42, 0);
    feather.rotation.z = -angle;
    feather.rotation.x = -0.25;
    tail.add(feather);
    tailFeathers.push(feather);
  }
  group.add(tail);

  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({
    map: textures.feather, color: 0x7a4a26, roughness: 0.9, side: THREE.DoubleSide,
  }));
  wingL.position.set(-0.58, 0.95, 0.05);
  wingL.rotation.y = -0.5;
  group.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 0.58;
  wingR.rotation.y = 0.5;
  group.add(wingR);

  const legMat = orange;
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), legMat);
  legL.position.set(-0.2, 0.25, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
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
