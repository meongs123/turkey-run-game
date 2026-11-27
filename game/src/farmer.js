// Gobble Run — Farmer Hodge and his three-state chase AI.
// CHASE follows the gap, SEARCH pauses and looks around after losing Pip,
// CORNER is the last-warning sprint when the gap gets short.
//
// Hodge is a fully rounded procedural human (~2.4 m tall, same footprint
// as before so chase AI + collision are untouched): sphere head with a
// simple face (eyes, nose, mouth, moustache, chin beard), a domed straw
// hat, plaid shirt, denim overalls with shoulder straps and buttons,
// capsule arms ending in rounded hands, capsule legs ending in boots.
// The animated parts (armL/armR/legL/legR/hatTop) stay single meshes
// rotated by update(); hands/boots ride along as their children.
import * as THREE from 'three';

export const FARMER_CHASE = 0;
export const FARMER_SEARCH = 1;
export const FARMER_CORNER = 2;

// Local copy of the rounded-box helper from scene.js (extruded rounded
// rectangle; outer footprint identical to the sharp box it replaces).
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

export function buildFarmer(textures) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ map: textures.plaid, roughness: 0.9 });
  const denim = new THREE.MeshStandardMaterial({ color: 0x2e4d7a, roughness: 0.9 });
  const straw = new THREE.MeshStandardMaterial({ color: 0xd9b95c, roughness: 0.9 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x4a2c12, roughness: 0.85 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a13b, roughness: 0.4, metalness: 0.6 });

  // ---- Torso: plaid shirt, softly rounded, with a denim apron front.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.40, 0.55, 6, 16), shirt);
  torso.position.y = 1.32;
  torso.scale.set(1, 1, 0.82);
  group.add(torso);
  // Shirt collar + neck.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.09, 12), shirt);
  collar.position.y = 1.68;
  group.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 12), skin);
  neck.position.y = 1.74;
  group.add(neck);
  // Denim waistband, bib apron, shoulder straps and brass buttons.
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.42, 0.12, 16), denim);
  waist.position.y = 0.94;
  waist.scale.set(1, 1, 0.82);
  group.add(waist);
  const bib = new THREE.Mesh(roundedBoxGeometry(0.52, 0.52, 0.10, 0.06, 0.03), denim);
  bib.position.set(0, 1.20, 0.31);
  group.add(bib);
  [-0.20, 0.20].forEach((x) => {
    const strap = new THREE.Mesh(roundedBoxGeometry(0.09, 0.55, 0.04, 0.03, 0.015), denim);
    strap.position.set(x, 1.52, 0.30);
    strap.rotation.x = -0.12;
    group.add(strap);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), brass);
    button.position.set(x, 1.40, 0.38);
    group.add(button);
  });

  // ---- Head: round, with ears, nose, eyes, brows, mouth, moustache
  // and a short chin beard. Front faces +Z, as before.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 18), skin);
  head.position.y = 2.04;
  head.scale.set(1, 1.06, 0.96);
  group.add(head);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * 0.28, 2.04, 0);
    group.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), dark);
    eye.position.set(s * 0.105, 2.09, 0.255);
    group.add(eye);
    const brow = new THREE.Mesh(roundedBoxGeometry(0.10, 0.025, 0.02, 0.01, 0.005), grey);
    brow.position.set(s * 0.105, 2.165, 0.26);
    brow.rotation.z = -s * 0.15;
    group.add(brow);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin);
  nose.scale.set(0.85, 1.1, 1.25);
  nose.position.set(0, 2.0, 0.28);
  group.add(nose);
  const mouth = new THREE.Mesh(roundedBoxGeometry(0.12, 0.018, 0.02, 0.008, 0.004), new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.9 }));
  mouth.position.set(0, 1.925, 0.285);
  group.add(mouth);
  [-1, 1].forEach((s) => {
    const mo = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.06, 4, 8), grey);
    mo.rotation.z = Math.PI / 2 - s * 0.35;
    mo.position.set(s * 0.06, 1.95, 0.27);
    group.add(mo);
  });
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 12), grey);
  beard.scale.set(0.95, 0.55, 0.6);
  beard.position.set(0, 1.83, 0.14);
  group.add(beard);

  // ---- Straw hat: flat brim + rounded dome crown (hatTop stays the
  // single animated mesh; the band rides along as its child).
  const hatTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw);
  hatTop.position.y = 2.29;
  const hatBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.035, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
  hatBand.rotation.x = Math.PI / 2;
  hatBand.position.y = 0.03;
  hatTop.add(hatBand);
  group.add(hatTop);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.035, 20), straw);
  hatBrim.position.y = 2.28;
  group.add(hatBrim);

  // ---- Arms: plaid capsule sleeves; each ends in a rounded skin hand
  // (fist + thumb) that swings with the arm as a child mesh.
  function makeArm(side) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 12), shirt);
    arm.position.set(side * 0.52, 1.32, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
    hand.scale.set(0.9, 1.15, 0.9);
    hand.position.set(0, -0.36, 0.02);
    arm.add(hand);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skin);
    thumb.position.set(-side * 0.09, -0.33, 0.07);
    arm.add(thumb);
    // Rolled sleeve cuff at the wrist.
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.025, 8, 14), shirt);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.28;
    arm.add(cuff);
    return arm;
  }
  const armL = makeArm(-1);
  group.add(armL);
  const armR = makeArm(1);
  group.add(armR);

  // The net: a torus rim plus a translucent mesh plane, carried at the
  // farmer's side (right hand) and tilted edge-on to the front, so the
  // torso — denim bib, straps and brass buttons — stays fully visible
  // from the front/title screen while the net still reads as a catch net.
  const netRim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 20), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
  netRim.position.set(0.78, 1.22, 0.08);
  netRim.rotation.set(0.12, 1.25, 0.30);
  group.add(netRim);
  const netMesh = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), new THREE.MeshBasicMaterial({
    color: 0xdddddd, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  }));
  netMesh.position.copy(netRim.position);
  netMesh.rotation.copy(netRim.rotation);
  group.add(netMesh);

  // ---- Legs: denim capsules; each ends in a brown boot (rounded box,
  // toe pointing forward) that swings with the leg as a child mesh.
  function makeLeg(side) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.45, 4, 12), denim);
    leg.position.set(side * 0.2, 0.45, 0);
    const boot = new THREE.Mesh(roundedBoxGeometry(0.18, 0.13, 0.34, 0.05, 0.03), bootMat);
    boot.position.set(0, -0.36, 0.07);
    leg.add(boot);
    return leg;
  }
  const legL = makeLeg(-1);
  group.add(legL);
  const legR = makeLeg(1);
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
