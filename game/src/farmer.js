// Gobble Run — Farmer Hodge and his three-state chase AI.
// CHASE follows the gap, SEARCH pauses and looks around after losing Pip,
// CORNER is the last-warning sprint when the gap gets short.
import * as THREE from 'three';

export const FARMER_CHASE = 0;
export const FARMER_SEARCH = 1;
export const FARMER_CORNER = 2;

export function buildFarmer(textures) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ map: textures.plaid, roughness: 0.9 });
  const denim = new THREE.MeshStandardMaterial({ color: 0x2e4d7a, roughness: 0.9 });
  const straw = new THREE.MeshStandardMaterial({ color: 0xd9b95c, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 12), shirt);
  torso.position.y = 1.25;
  group.add(torso);

  const overalls = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.4), denim);
  overalls.position.y = 0.75;
  group.add(overalls);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), skin);
  head.position.y = 2.05;
  group.add(head);

  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1 }));
  beard.scale.set(1, 0.7, 0.7);
  beard.position.set(0, 1.88, 0.18);
  group.add(beard);

  const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.35, 12), straw);
  hatTop.position.y = 2.38;
  group.add(hatTop);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), straw);
  hatBrim.position.y = 2.24;
  group.add(hatBrim);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), shirt);
  armL.position.set(-0.55, 1.3, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  group.add(armR);

  // The net: a torus rim plus a translucent mesh plane, held up front.
  const netRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 20), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
  netRim.position.set(0.35, 1.5, 0.55);
  group.add(netRim);
  const netMesh = new THREE.Mesh(new THREE.CircleGeometry(0.48, 20), new THREE.MeshBasicMaterial({
    color: 0xdddddd, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  }));
  netMesh.position.copy(netRim.position);
  group.add(netMesh);

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), denim);
  legL.position.set(-0.2, 0.3, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);

  const marker = new THREE.Group();
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const qBall = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), markerMat);
  const qStem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), markerMat);
  qStem.position.y = -0.26;
  marker.add(qBall);
  marker.add(qStem);
  marker.position.y = 2.9;
  marker.visible = false;
  group.add(marker);

  return {
    group, armL, armR, legL, legR, hatTop, marker, markerMat,
    runPhase: 0,
    update(dt, speedNorm, mode, time) {
      this.runPhase += dt * (6 + speedNorm * 8);
      const swing = Math.sin(this.runPhase) * 0.8;
      if (mode === FARMER_SEARCH) {
        // Stopped, scanning left and right.
        this.armL.rotation.x = 0.1;
        this.armR.rotation.x = 0.1;
        this.legL.rotation.x = 0;
        this.legR.rotation.x = 0;
        group.rotation.y = Math.sin(time * 1.6) * 0.9;
        this.marker.visible = true;
        this.markerMat.color.setHex(0xffd23e);
      } else {
        this.armL.rotation.x = swing;
        this.armR.rotation.x = -swing;
        this.legL.rotation.x = -swing * 0.9;
        this.legR.rotation.x = swing * 0.9;
        this.hatTop.rotation.z = Math.sin(this.runPhase) * 0.08;
        group.rotation.y = 0;
        if (mode === FARMER_CORNER) {
          this.marker.visible = true;
          this.markerMat.color.setHex(0xff3b30);
        } else {
          this.marker.visible = false;
        }
      }
    },
  };
}
