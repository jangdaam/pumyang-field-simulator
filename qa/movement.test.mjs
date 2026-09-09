import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget, renderScale } from '../lib/field/frame-budget.ts';

test('render budget stays near 60 FPS on 60/120/144/240 Hz screens', () => {
  for (const hz of [60, 120, 144, 240]) {
    const budget = new FrameBudget();
    let frames = 0;
    for (let i = 0; i < hz * 10; i++)
      if (budget.take((i * 1000) / hz)) frames++;
    assert.ok(
      frames >= 590 && frames <= 601,
      `${hz} Hz produced ${frames} frames`,
    );
    assert.equal(
      budget.take(20000),
      true,
      'a long stall must not block resuming',
    );
  }
});

test('render scale bounds 4K/high-DPI GPU work without upscaling low-DPI screens', () => {
  for (const [w, h, dpr] of [
    [3840, 2160, 2],
    [1920, 1080, 2],
    [543, 794, 1],
  ]) {
    const scale = renderScale(w, h, dpr);
    assert.ok(w * h * scale * scale <= 2_100_001);
    assert.ok(scale <= dpr && scale <= 1.25);
  }
});
import {
  intersectsRect,
  slideMove,
  cameraMovement,
  vehicleMotion,
} from '../lib/field/movement.ts';

test('diagonal walking keeps the same speed in every camera orientation', () => {
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI * 1.5]) {
    const v = cameraMovement(1, -1, angle);
    assert.ok(Math.abs(Math.hypot(v.x, v.z) - 1) < 1e-12);
  }
  assert.deepEqual(cameraMovement(0, 0, 0), { x: 0, z: 0 });
});
test('running cannot tunnel through a thin barrier on a long frame', () => {
  const wall = { x: 0, z: 0, w: 0.2, d: 20 };
  const p = slideMove(-4, 0, 12, 0, (x, z) => intersectsRect(x, z, 0.7, wall));
  assert.ok(p.x <= -0.8);
  assert.equal(p.z, 0);
});
test('a blocked diagonal slides along a wall without trapping the player', () => {
  const wall = { x: 0, z: 0, w: 0.2, d: 20 };
  const p = slideMove(-2, 0, 4, 4, (x, z) => intersectsRect(x, z, 0.7, wall));
  assert.ok(p.x <= -0.8);
  assert.ok(Math.abs(p.z - 4) < 1e-10);
});
test('the excavation boundary protects the rail and accounts for equipment radius', () => {
  const pit = { x: 7, z: -13, w: 74, d: 54 };
  const p = slideMove(-20, 22, 0, -12, (x, z) =>
    intersectsRect(x, z, 3.4, pit),
  );
  assert.ok(p.z >= 17.4);
  assert.ok(p.z < 17.71);
  assert.equal(intersectsRect(44.4, 14.4, 0.7, pit), true);
  assert.equal(intersectsRect(44.6, 14.6, 0.7, pit), false);
});

test('truck steering reverses in reverse and cannot pivot while stationary', () => {
  assert.equal(vehicleMotion(0, 0, 1, false, true, 1 / 60).yaw, 0);
  assert.ok(vehicleMotion(5, 1, 1, false, true, 1 / 60).yaw > 0);
  assert.ok(vehicleMotion(-5, -1, 1, false, true, 1 / 60).yaw < 0);
  assert.ok(vehicleMotion(0, 0, 1, false, false, 1 / 60).yaw > 0);
});
test('truck acceleration, coasting and braking remain stable across frame rates', () => {
  const drive = (rate) => {
    let speed = 0;
    for (let i = 0; i < rate * 2; i++)
      speed = vehicleMotion(speed, 1, 0, false, true, 1 / rate).speed;
    return speed;
  };
  assert.ok(Math.abs(drive(30) - drive(120)) < 1e-9);
  assert.ok(drive(60) > 13 && drive(60) < 14);
  assert.ok(vehicleMotion(10, 0, 0, false, true, 0.1).speed < 10);
  assert.deepEqual(vehicleMotion(12, 1, 1, true, true, 0.1), {
    speed: 0,
    yaw: 0,
  });
});
