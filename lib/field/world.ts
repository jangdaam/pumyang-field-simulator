import * as T from 'three';
import {
  box,
  cylinder,
  beam,
  mesh,
  textPlane,
  groundText,
  batchStatic,
  palette as c,
  random,
} from './geometry';
export type Obstacle = { x: number; z: number; w: number; d: number };
export const obstacles: Obstacle[] = [
  { x: 7, z: -13, w: 74, d: 54 },
  { x: -64, z: 45, w: 23, d: 12 },
  { x: -62, z: -46, w: 26, d: 21 },
  { x: 57, z: 43, w: 24, d: 18 },
  { x: 70, z: -32, w: 16, d: 26 },
  { x: -6, z: 23, w: 6, d: 7 },
  { x: 4, z: 23, w: 6, d: 7 },
  { x: 8, z: 57, w: 19, d: 5 },
];
export const soilPiles = [
  { x: 22, z: 23, r: 4.2 },
  { x: 32, z: 22, r: 3.6 },
  { x: 72, z: 4, r: 5.5 },
  { x: -70, z: 9, r: 5 },
];
function railing(
  p: T.Object3D,
  x: number,
  z: number,
  length: number,
  axis: 'x' | 'z',
) {
  for (let i = 0; i <= length; i += 3) {
    const dx = axis === 'x' ? i : 0,
      dz = axis === 'z' ? i : 0;
    box(p, 0.15, 1.3, 0.15, c.orange, x + dx, 0.65, z + dz);
  }
  for (const h of [0.65, 1.2])
    beam(
      p,
      [x, h, z],
      [x + (axis === 'x' ? length : 0), h, z + (axis === 'z' ? length : 0)],
      0.055,
      c.cream,
    );
}
function cone(p: T.Object3D, x: number, z: number) {
  box(p, 0.65, 0.09, 0.65, c.dark, x, 0.05, z);
  mesh(new T.ConeGeometry(0.25, 0.85, 6), c.orange, p, x, 0.48, z);
  cylinder(p, 0.15, 0.14, c.cream, x, 0.59, z);
}
function tree(p: T.Object3D, x: number, z: number, sz: number) {
  cylinder(p, 0.25, 2.2, c.cut, x, 1, z);
  const a = mesh(
    new T.IcosahedronGeometry(sz, 0),
    c.tree,
    p,
    x,
    2.5 + sz * 0.5,
    z,
  );
  a.scale.set(1, 1.25, 0.85);
  mesh(
    new T.IcosahedronGeometry(sz * 0.7, 0),
    0x7c925e,
    p,
    x + sz * 0.5,
    2.3 + sz,
    z - 0.4,
  );
}
function fence(
  p: T.Object3D,
  x: number,
  z: number,
  length: number,
  axis: 'x' | 'z',
) {
  for (let i = 0; i < length; i += 4) {
    const dx = axis === 'x' ? i : 0,
      dz = axis === 'z' ? i : 0;
    box(
      p,
      axis === 'x' ? 3.8 : 0.16,
      2.6,
      axis === 'z' ? 3.8 : 0.16,
      i % 12 === 0 ? 0x557775 : c.navy,
      x + dx,
      1.4,
      z + dz,
    );
    box(
      p,
      0.24,
      3,
      0.24,
      c.cream,
      x + dx - 2,
      1.5,
      z + dz - 2 * (axis === 'z' ? 1 : 0),
    );
  }
  box(
    p,
    axis === 'x' ? length : 0.45,
    0.5,
    axis === 'z' ? length : 0.45,
    c.cream,
    x + (axis === 'x' ? length / 2 - 2 : 0),
    0.25,
    z + (axis === 'z' ? length / 2 - 2 : 0),
  );
}
export function createWorld() {
  const p = new T.Group(),
    rand = random(803);
  // A continuous site datum with a genuine recessed excavation.
  box(p, 600, 2, 600, 0x92a183, 0, -9.5, 0);
  box(p, 180, 1, 140, c.cut, 0, -8, 0);
  box(p, 180, 8, 32, c.earth, 0, -4, -54);
  box(p, 180, 8, 58, c.earth, 0, -4, 41);
  box(p, 62, 8, 50, c.earth, -59, -4, -13);
  box(p, 48, 8, 50, c.earth, 66, -4, -13);
  box(p, 180, 0.07, 10, c.road, 0, 0.004, 34);
  box(p, 10, 0.07, 132, c.road, -39, 0.005, -1);
  box(p, 9, 0.07, 115, c.road, 56, 0.008, -4);
  box(p, 150, 0.07, 8, c.road, 0, 0.008, -47);
  for (let x = -80; x < 83; x += 9) {
    box(p, 4, 0.02, 0.16, c.cream, x, 0.053, 34);
  }
  for (let z = -57; z < 61; z += 9) {
    box(p, 0.16, 0.02, 4, c.cream, -39, 0.053, z);
    box(p, 0.16, 0.02, 4, c.cream, 56, 0.053, z);
  }
  groundText(p, 'PUMYANG E&C', -9, 49, 30);
  groundText(p, '01  /  EQUIPMENT', -22, 17, 16);
  groundText(p, '03  /  MATERIALS', 51, 57, 19);
  // Exposed retaining wall, capped diaphragm panels, and PPS struts.
  box(p, 68, 0.4, 48, 0xb49f7b, 7, -7.3, -13);
  for (let x = -27; x < 43; x += 3.5) {
    box(p, 3.42, 7.1, 0.75, 0xd7d4bd, x, -3.6, -37.7);
    box(p, 3.42, 7.1, 0.75, 0xc6c4ad, x, -3.6, 11.7);
  }
  for (let z = -36; z < 12; z += 3.5) {
    box(p, 0.75, 7.1, 3.42, 0xd3cfb8, -27.7, -3.6, z);
    box(p, 0.75, 7.1, 3.42, 0xd3cfb8, 41.7, -3.6, z);
  }
  for (const z of [-36, 10]) {
    box(p, 69, 0.45, 1.3, c.cream, 7, 0.08, z);
    box(p, 68, 0.65, 0.6, c.steel, 7, -2, z);
  }
  for (const x of [-27, 41]) {
    box(p, 1.3, 0.45, 48, c.cream, x, 0.08, -13);
    box(p, 0.6, 0.65, 47, c.steel, x, -2, -13);
  }
  for (let z = -32; z <= 7; z += 8) {
    beam(p, [-26, -1.2, z], [40, -1.2, z], 0.39, 0xb8c1b0);
    for (const x of [-12, 12, 30]) {
      box(p, 0.65, 6, 0.65, c.steel, x, -4, z);
      cylinder(p, 0.62, 0.7, c.orange, x, -1.2, z).rotation.z = Math.PI / 2;
    }
  }
  for (const z of [-29, 3]) {
    beam(p, [-25, -3.5, z], [39, -3.5, z], 0.29, 0x9cae9c);
  }
  for (const [x, z, dx, dz] of [
    [-26, -36, 12, 10],
    [40, -36, -12, 10],
    [-26, 10, 12, -10],
    [40, 10, -12, -10],
  ])
    beam(p, [x, -1.1, z + dz], [x + dx, -1.1, z], 0.32, c.steel);
  railing(p, -29, 14, 73, 'x');
  railing(p, -29, -40, 73, 'x');
  railing(p, -30, -38, 48, 'z');
  railing(p, 44, -38, 48, 'z');
  for (let i = 0; i < 10; i++) {
    const x = -20 + rand() * 52,
      z = -31 + rand() * 35;
    box(p, 2 + rand() * 4, 0.25, 2 + rand() * 3, c.cream, x, -7, z);
  }
  // Ground forms: broad, deliberately faceted stockpiles.
  for (const [x, z, r] of [
    [22, 23, 4.2],
    [32, 22, 3.6],
    [72, 4, 5.5],
    [-70, 9, 5],
  ]) {
    const m = mesh(new T.ConeGeometry(r, 3, 7), c.soil, p, x, 1.25, z);
    m.rotation.y = 0.3;
  }
  // Slurry treatment compound and recognizable silo cluster.
  box(p, 29, 0.14, 22, 0xb8b39c, -62, 0.03, -47);
  for (let i = 0; i < 3; i++) {
    const x = -72 + i * 8;
    for (const dx of [-1.2, 1.2])
      for (const dz of [-1.2, 1.2])
        box(p, 0.2, 3, 0.2, c.steel, x + dx, 1.5, -51 + dz);
    cylinder(p, 2, 7, c.cream, x, 6.6, -51);
    mesh(new T.ConeGeometry(2, 2, 12), c.orange, p, x, 2.1, -51).rotation.z =
      Math.PI;
    cylinder(p, 2.03, 0.6, c.orange, x, 9.95, -51);
    const label = textPlane(p, 'PUMYANG', 3, 0.8, '#365349');
    label.position.set(x, 7.4, -48.99);
    beam(p, [x + 2, 1, -51], [x + 2, 10, -51], 0.07, c.steel);
  }
  box(p, 17, 2.5, 5, c.yellow, -61, 2, -40);
  box(p, 18, 0.25, 5.8, c.dark, -61, 3.4, -40);
  for (let x = -68; x < -52; x += 3) {
    box(p, 1.9, 1.2, 3.5, c.orange, x, 4, -40);
    box(p, 0.15, 4, 0.15, c.dark, x, 2, -38);
  }
  beam(p, [-68, 0.6, -38], [-68, 0.6, -24], 0.15, c.navy);
  beam(p, [-68, 0.6, -24], [-53, 0.6, -24], 0.15, c.navy);
  const ps = textPlane(p, 'SLURRY PLANT', 16, 2, '#f4eccf', '#365552');
  ps.position.set(-62, 4, -36.9);
  // Site offices and a covered break area.
  for (const x of [-69, -57]) {
    box(p, 11, 4.1, 9, c.cream, x, 2.1, 45);
    box(p, 11.5, 0.3, 9.5, c.navy, x, 4.25, 45);
    box(p, 1.5, 2.8, 0.1, c.navy, x - 3, 0.0 + 1.4, 49.55);
    for (const dx of [0, 3]) {
      box(p, 2.1, 1.7, 0.12, c.white, x + dx, 2.5, 49.56);
      box(p, 1.8, 1.4, 0.14, 0x719390, x + dx, 2.5, 49.65);
    }
  }
  const sign = textPlane(
    p,
    'PUMYANG  /  SITE OFFICE',
    20,
    1.7,
    '#eeede0',
    '#314c49',
  );
  sign.position.set(-63, 3.8, 49.8);
  box(p, 25, 0.25, 3, 0xd5c7a5, -63, 0.12, 51.4);
  for (const x of [-75, -51]) box(p, 0.16, 3, 0.16, c.dark, x, 1.5, 55);
  box(p, 25, 0.15, 4, c.navy, -63, 3, 55);
  for (const x of [-70, -61]) {
    box(p, 5, 0.2, 1.3, c.cut, x, 0.9, 55);
    for (const dx of [-2, 2]) box(p, 0.2, 0.8, 0.8, c.steel, x + dx, 0.4, 55);
  }
  // Material racks, steel pipes, rebar cages, pallets, and concrete segments.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const m = cylinder(
        p,
        0.38,
        11,
        i % 2 ? c.steel : 0x8b9282,
        47 + i * 1,
        0.6 + j * 0.72,
        43,
      );
      m.rotation.x = Math.PI / 2;
    }
  }
  for (const z of [41, 48])
    for (const x of [63, 68]) {
      box(p, 3, 0.25, 3, c.cut, x, 0.2, z);
      for (let i = 0; i < 3; i++)
        box(
          p,
          2.4,
          0.65,
          2.4,
          i % 2 ? c.cream : 0xd6d1ba,
          x,
          0.75 + i * 0.7,
          z,
        );
    }
  for (let i = 0; i < 6; i++) {
    const x = 67 + (i % 2) * 7,
      z = -39 + Math.floor(i / 2) * 9;
    cylinder(p, 2.8, 0.2, c.cream, x, 0.1, z);
    const tube = new T.Mesh(
      new T.CylinderGeometry(2.1, 2.1, 0.22, 16, 1, true),
      new T.MeshStandardMaterial({
        color: c.dark,
        side: T.DoubleSide,
        flatShading: true,
      }),
    );
    tube.position.set(x, 0.15, z);
    p.add(tube);
  }
  // Clear work-zone markers and wheel stops.
  for (const [x, z] of [
    [-32, 27],
    [-22, 27],
    [-33, 17],
    [-22, 17],
    [44, -2],
    [54, -2],
    [-54, -17],
    [-44, -17],
    [40, 30],
    [72, 30],
  ])
    cone(p, x, z);
  for (const x of [-16, -6, 4]) {
    box(p, 6, 0.06, 8, 0xb6aa88, x, 0.04, 23);
    for (const dx of [-3, 3]) box(p, 0.12, 0.08, 8, c.cream, x + dx, 0.06, 23);
  }
  // A small service yard gives walking routes scale and recognizable destinations.
  for (const x of [-6, 4]) {
    box(p, 4, 0.25, 5, c.cut, x, 0.18, 23);
    for (let j = 0; j < 5; j++) {
      box(p, 3.7, 0.23, 4.6, j % 2 ? c.cream : c.orange, x, 0.5 + j * 0.28, 23);
    }
    for (const dz of [-1.7, 1.7])
      box(p, 3.9, 1.55, 0.13, c.dark, x, 0.9, 23 + dz);
  }
  for (const x of [1, 8, 15]) {
    const ring = mesh(
      new T.CylinderGeometry(1.9, 1.9, 1.7, 12, 1, true),
      c.cream,
      p,
      x,
      0.86,
      57,
    );
    (ring.material as T.MeshStandardMaterial).side = T.DoubleSide;
    cylinder(p, 1.65, 0.08, c.cut, x, 0.08, 57);
  }
  for (const [x, z] of [
    [-48, 19],
    [35, 56],
    [59, -55],
  ]) {
    box(p, 1.5, 0.5, 1.5, c.navy, x, 0.25, z);
    beam(p, [x, 0.4, z], [x, 6, z], 0.09, c.steel);
    box(p, 2.2, 0.4, 0.45, c.dark, x, 6, z);
    for (const dx of [-0.65, 0.65])
      box(p, 0.8, 0.28, 0.08, c.cream, x + dx, 6, z + 0.25);
  }
  // Peripheral boundary with an open, readable entrance.
  fence(p, -88, -67, 176, 'x');
  fence(p, -88, -65, 130, 'z');
  fence(p, 88, -65, 130, 'z');
  fence(p, -86, 67, 45, 'x');
  fence(p, -25, 67, 112, 'x');
  for (const x of [-45, -28]) box(p, 0.6, 6, 0.6, c.cream, x, 3, 65);
  box(p, 18, 0.7, 0.6, c.navy, -36.5, 6, 65);
  const gs = textPlane(p, 'PUMYANG E&C', 15, 1.5, '#faf3d9', '#2c4948');
  gs.position.set(-36.5, 5.5, 65.4);
  // Stylized city edge. Geometry carries all detail; no noisy textures.
  box(p, 240, 0.15, 13, 0x727f78, 0, -0.06, -83);
  for (let x = -105; x < 110; x += 9)
    box(p, 4, 0.02, 0.18, c.cream, x, 0.03, -83);
  for (let i = 0; i < 11; i++) {
    const x = -105 + i * 21,
      h = 10 + rand() * 21,
      d = 9 + rand() * 7;
    box(
      p,
      11 + rand() * 5,
      h,
      d,
      i % 3 === 0 ? 0xa6b8ab : 0xbac3b0,
      x,
      h / 2,
      -107,
    );
    box(p, 13, 0.3, d + 1, 0x8eaa9c, x, h, -107);
    for (let y = 3; y < h - 2; y += 4)
      box(p, 8, 0.7, 0.1, 0x889f95, x, y, -107 + d / 2 + 0.1);
  }
  for (let z = -60; z <= 67; z += 14) {
    tree(p, 96, z, 3.5 + rand());
    tree(p, -97, z, 3 + rand());
  }
  for (let x = -83; x < 90; x += 16) tree(p, x, -74, 2.5 + rand());
  return batchStatic(p);
}
