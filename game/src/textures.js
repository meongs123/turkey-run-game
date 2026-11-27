// Gobble Run — procedural textures. Every surface in the game is a small
// 2D canvas painted once at boot: grass, wood, straw, feathers, plaid
// shirt, brick and a sign board. No image files anywhere.
import * as THREE from 'three';
import { makeRng } from './rng.js';

function paintCanvas(size, painter, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size, makeRng(seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function grassTexture() {
  return paintCanvas(256, (ctx, size, rng) => {
    ctx.fillStyle = '#5d7a33';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i += 1) {
      const g = 90 + Math.floor(rng.next() * 70);
      ctx.fillStyle = `rgb(${50 + Math.floor(rng.next() * 40)},${g},${30 + Math.floor(rng.next() * 30)})`;
      const x = rng.next() * size;
      const y = rng.next() * size;
      ctx.fillRect(x, y, 2, 3 + rng.next() * 5);
    }
    for (let i = 0; i < 26; i += 1) {
      ctx.fillStyle = 'rgba(190,150,60,0.25)';
      ctx.beginPath();
      ctx.arc(rng.next() * size, rng.next() * size, 6 + rng.next() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 11);
}

function woodTexture() {
  return paintCanvas(256, (ctx, size, rng) => {
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#7d4f24' : '#96682f';
      ctx.fillRect(0, y, size, 30);
      ctx.fillStyle = 'rgba(40,20,5,0.55)';
      ctx.fillRect(0, y + 30, size, 2);
      for (let i = 0; i < 14; i += 1) {
        ctx.strokeStyle = 'rgba(60,30,8,0.35)';
        ctx.beginPath();
        const yy = y + 4 + rng.next() * 24;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(size * 0.3, yy + rng.range(-3, 3), size * 0.7, yy + rng.range(-3, 3), size, yy);
        ctx.stroke();
      }
    }
  }, 23);
}

function strawTexture() {
  return paintCanvas(256, (ctx, size, rng) => {
    ctx.fillStyle = '#c9a13b';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i += 1) {
      ctx.strokeStyle = rng.chance(0.5) ? 'rgba(230,190,80,0.7)' : 'rgba(150,110,30,0.7)';
      ctx.beginPath();
      const x = rng.next() * size;
      const y = rng.next() * size;
      const a = rng.next() * Math.PI;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      ctx.stroke();
    }
  }, 37);
}

function featherTexture() {
  return paintCanvas(256, (ctx, size, rng) => {
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 500; i += 1) {
      const shade = 70 + Math.floor(rng.next() * 60);
      ctx.fillStyle = `rgb(${shade + 40},${Math.floor(shade * 0.6)},${Math.floor(shade * 0.35)})`;
      ctx.fillRect(rng.next() * size, rng.next() * size, 2, 6 + rng.next() * 8);
    }
    ctx.fillStyle = 'rgba(255,220,150,0.35)';
    ctx.fillRect(size / 2 - 2, 0, 4, size);
  }, 51);
}

function plaidTexture() {
  return paintCanvas(128, (ctx, size) => {
    ctx.fillStyle = '#a33327';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(240,230,200,0.55)';
    for (let i = 0; i < size; i += 32) {
      ctx.fillRect(i, 0, 6, size);
      ctx.fillRect(0, i, size, 6);
    }
    ctx.fillStyle = 'rgba(30,60,110,0.6)';
    for (let i = 16; i < size; i += 32) {
      ctx.fillRect(i, 0, 3, size);
      ctx.fillRect(0, i, size, 3);
    }
  }, 67);
}

function brickTexture() {
  return paintCanvas(256, (ctx, size, rng) => {
    ctx.fillStyle = '#7a4a38';
    ctx.fillRect(0, 0, size, size);
    const bh = 24;
    const bw = 62;
    for (let y = 0; y < size; y += bh) {
      const off = (y / bh) % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw; x < size + bw; x += bw) {
        const r = 110 + Math.floor(rng.next() * 40);
        ctx.fillStyle = `rgb(${r},${Math.floor(r * 0.55)},${Math.floor(r * 0.45)})`;
        ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
  }, 83);
}

function signTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#d9b06a';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#f4e3b2';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeTextures() {
  return {
    grass: grassTexture(),
    wood: woodTexture(),
    straw: strawTexture(),
    feather: featherTexture(),
    plaid: plaidTexture(),
    brick: brickTexture(),
    sign: signTexture('MAPLEWOOD EDGE'),
  };
}
