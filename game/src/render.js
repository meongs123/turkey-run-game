// Gobble Run — camera follow. Damped chase camera with a dash FOV kick
// and decaying trauma shake. Frame-rate independent: every ease uses
// 1 - exp(-dt * k), never a fixed lerp factor.
import * as THREE from 'three';
import { CAMERA } from './config.js';

export function createCameraRig(camera) {
  const targetPos = new THREE.Vector3(0, CAMERA.offset[1], CAMERA.offset[2]);
  const lookAt = new THREE.Vector3(0, 1.2, -10);
  const shakeOffset = new THREE.Vector3();
  let trauma = 0;
  let fov = CAMERA.fov;

  return {
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    update(dt, playerX, playerY, playerZ, steerLean, dashing, time) {
      const damp = 1 - Math.exp(-dt * CAMERA.damp);
      targetPos.set(
        playerX * 0.55 + steerLean * 0.8,
        CAMERA.offset[1] + playerY * 0.35,
        -playerZ + CAMERA.offset[2],
      );
      camera.position.lerp(targetPos, damp);
      lookAt.set(playerX * 0.8, 1.1 + playerY * 0.3, -playerZ - 12);
      camera.lookAt(lookAt);
      const targetFov = dashing ? CAMERA.dashFov : CAMERA.fov;
      fov += (targetFov - fov) * Math.min(1, dt * 5);
      if (Math.abs(fov - camera.fov) > 0.05) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      trauma = Math.max(0, trauma - dt * CAMERA.shakeDecay);
      if (trauma > 0.001) {
        const amp = trauma * trauma * CAMERA.shakeMax;
        shakeOffset.set(
          (Math.sin(time * 61.7) + Math.sin(time * 47.3)) * 0.5 * amp,
          (Math.sin(time * 53.1) + Math.sin(time * 39.7)) * 0.5 * amp,
          0,
        );
        camera.position.add(shakeOffset);
      }
    },
  };
}
