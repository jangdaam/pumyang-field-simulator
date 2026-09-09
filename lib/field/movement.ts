export type Rect = { x: number; z: number; w: number; d: number };
export const WALK_SPEED = 6.24;
export const RUN_SPEED = 11.05;
export function vehicleMotion(
  speed: number,
  drive: number,
  steer: number,
  brake: boolean,
  truck: boolean,
  dt: number,
) {
  if (brake) return { speed: 0, yaw: 0 };
  const target = drive * (truck ? (drive > 0 ? 14 : 5.5) : 2.1);
  const response = truck ? (drive ? 1.8 : 2.4) : drive ? 3.5 : 8;
  const next = target + (speed - target) * Math.exp(-response * dt);
  return {
    speed: Math.abs(next) < 0.001 ? 0 : next,
    yaw: steer * (truck ? Math.tanh(next / 4) * 1.35 : 0.47) * dt,
  };
}
export function intersectsRect(x: number, z: number, r: number, b: Rect) {
  const dx = x - Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2)),
    dz = z - Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
  return dx * dx + dz * dz < r * r;
}
export function slideMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  blocked: (x: number, z: number) => boolean,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  for (let i = 0; i < steps; i++) {
    if (!blocked(x + dx / steps, z)) x += dx / steps;
    if (!blocked(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}
export function cameraMovement(
  horizontal: number,
  vertical: number,
  azimuth: number,
) {
  const n = Math.hypot(horizontal, vertical) || 1;
  return {
    x: (Math.cos(azimuth) * horizontal + Math.sin(azimuth) * vertical) / n,
    z: (-Math.sin(azimuth) * horizontal + Math.cos(azimuth) * vertical) / n,
  };
}
