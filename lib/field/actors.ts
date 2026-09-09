import * as T from 'three';
import {
  box,
  cylinder,
  beam,
  mesh,
  textPlane,
  batchParts,
  palette as c,
} from './geometry';
import { equipment, type EquipmentId } from './catalog';
export type Machine = {
  id: EquipmentId;
  root: T.Group;
  upper: T.Group;
  boom: T.Group;
  wire: T.Mesh;
  tool: T.Group;
  jaws: T.Group[];
  rotors: T.Object3D[];
  angle: number;
  slew: number;
  cable: number;
  open: number;
  spinning: boolean;
  speed: number;
  length: number;
  trackParts: T.Object3D[];
  radius: number;
  origin: T.Vector3;
  originYaw: number;
};
function tracks(p: T.Group) {
  const parts: T.Object3D[] = [];
  for (const x of [-2.15, 2.15]) {
    box(p, 1.25, 1.1, 6.5, c.dark, x, 0.75, 0);
    for (let z = -2.6; z <= 2.7; z += 1.3) {
      const m = cylinder(p, 0.49, 1.29, c.steel, x, 0.73, z);
      m.rotation.z = Math.PI / 2;
      parts.push(m);
    }
    for (let z = -3; z <= 3; z += 0.55) {
      box(p, 1.4, 0.12, 0.25, 0x52605a, x, 1.35, z);
      box(p, 1.4, 0.12, 0.25, 0x52605a, x, 0.17, z);
    }
    box(p, 1.3, 0.15, 5.8, 0x657165, x, 1.48, 0);
  }
  box(p, 3.9, 0.7, 4.8, c.steel, 0, 1.15, 0);
  return parts;
}
function lattice(p: T.Group, length: number, color: number) {
  for (const x of [-0.55, 0.55])
    for (const z of [-0.5, 0.5])
      beam(p, [x, 0, z], [x, length, z], 0.075, color);
  for (let y = 0; y < length; y += 1.8) {
    for (const z of [-0.5, 0.5]) {
      beam(
        p,
        [-0.55, y, z],
        [0.55, Math.min(y + 1.8, length), z],
        0.045,
        color,
      );
      beam(
        p,
        [0.55, y, z],
        [-0.55, Math.min(y + 1.8, length), z],
        0.045,
        color,
      );
    }
    for (const x of [-0.55, 0.55])
      beam(p, [x, y, -0.5], [x, Math.min(y + 1.8, length), 0.5], 0.045, color);
  }
}
export function createMachine(def: (typeof equipment)[number]): Machine {
  if (def.id === 'truck') return createTruck(def);
  const root = new T.Group();
  root.position.set(def.x, 0, def.z);
  root.rotation.y = def.rotation;
  const trackParts = tracks(root);
  const upper = new T.Group();
  upper.position.y = 1.5;
  root.add(upper);
  cylinder(upper, 1.9, 0.35, c.dark, 0, 0.1, 0);
  box(upper, 4.9, 0.65, 5.8, def.color, 0, 0.6, 0);
  box(upper, 4.6, 1.7, 2.5, def.color, 0, 1.7, 1.4);
  box(upper, 4.7, 0.25, 2.6, c.dark, 0, 2.65, 1.4);
  for (let x = -1.6; x < 1.7; x += 0.5)
    box(upper, 0.12, 1.1, 0.07, c.dark, x, 1.8, 2.7);
  // Offset glazed cab and a visible boarding step.
  box(upper, 1.8, 2.1, 2.5, c.cream, -1.55, 2, -1.2);
  box(upper, 1.9, 0.2, 2.65, c.navy, -1.55, 3.1, -1.2);
  box(upper, 1.55, 1.3, 0.09, 0x426264, -1.55, 2.28, -2.49);
  box(upper, 0.09, 1.3, 2.12, 0x527977, -2.47, 2.28, -1.2);
  box(upper, 0.12, 1.5, 0.1, c.cream, -2.51, 2.2, -1.3);
  box(upper, 0.8, 0.18, 1.7, c.steel, -2.85, 0.7, -1);
  box(upper, 0.6, 0.16, 1.5, c.steel, -3.08, 0.38, -1);
  cylinder(upper, 0.15, 0.4, c.orange, -1.6, 3.45, -1.1);
  const logo = textPlane(upper, 'PUMYANG', 3.7, 0.8, '#254747');
  logo.position.set(0, 1.9, 2.72);
  const boom = new T.Group();
  boom.position.set(0.4, 1.0, -1.3);
  upper.add(boom);
  const length = def.id === 'crane' ? 20 : def.id === 'cutter' ? 18 : 16;
  lattice(boom, length, def.id === 'cutter' ? c.navy : def.color);
  box(boom, 1.4, 0.6, 1.3, c.dark, 0, length, 0);
  const pulley = cylinder(boom, 0.43, 1.4, c.orange, 0, length, 0);
  pulley.rotation.z = Math.PI / 2;
  beam(upper, [0.5, 1.8, 2], [0.5, 7, 1.5], 0.12, c.dark);
  beam(upper, [0.5, 7, 1.5], [0.5, 1.5, -1.3], 0.09, c.dark);
  const wire = cylinder(upper, 0.04, 1, c.dark);
  const tool = new T.Group();
  upper.add(tool);
  const jaws: T.Group[] = [],
    rotors: T.Object3D[] = [];
  if (def.id === 'crane') {
    box(tool, 0.65, 0.8, 0.38, c.dark, 0, 0, 0);
    for (const x of [-0.17, 0.17]) box(tool, 0.09, 0.7, 0.4, c.yellow, x, 0, 0);
    const hook = mesh(
      new T.TorusGeometry(0.39, 0.1, 6, 12, Math.PI * 1.65),
      c.dark,
      tool,
      0,
      -0.7,
      0,
    );
    hook.rotation.z = 0.4;
  }
  if (def.id === 'cutter') {
    box(tool, 2.5, 5.2, 1.6, def.color, 0, -2, 0);
    box(tool, 2.7, 0.55, 1.8, c.navy, 0, -0.1, 0);
    box(tool, 2.7, 0.5, 1.8, c.navy, 0, -3.8, 0);
    for (const x of [-0.88, 0.88]) {
      box(tool, 0.22, 4.7, 1.75, c.cream, x, -2, 0);
      const r = cylinder(tool, 0.85, 1.8, c.dark, x, -5, 0);
      r.rotation.x = Math.PI / 2;
      rotors.push(r);
      for (let i = 0; i < 8; i++) {
        const tooth = box(
          r,
          0.22,
          0.15,
          1.14,
          c.steel,
          Math.cos((i * Math.PI) / 4) * 0.93,
          0,
          Math.sin((i * Math.PI) / 4) * 0.93,
        );
        tooth.rotation.y = (-i * Math.PI) / 4;
      }
    }
    for (const x of [-0.5, 0.5])
      beam(upper, [x, 2.8, 2], [x, 12, -2], 0.07, c.dark);
    const t = textPlane(tool, 'SC40', 2, 0.7, '#244841');
    t.position.set(0, -2, 0.82);
  }
  if (def.id === 'grab') {
    box(tool, 1.7, 4.2, 1.3, def.color, 0, -1.8, 0);
    for (const x of [-0.57, 0.57])
      box(tool, 0.22, 4.3, 1.6, c.dark, x, -1.8, 0);
    for (const sign of [-1, 1]) {
      const jaw = new T.Group();
      jaw.position.set(sign * 0.2, -3.6, 0);
      tool.add(jaw);
      box(jaw, 1.5, 0.5, 2, def.color, sign * 0.6, -0.3, 0);
      box(jaw, 0.3, 1.7, 2, def.color, sign * 1.2, -0.95, 0);
      for (const z of [-0.7, 0, 0.7])
        box(jaw, 0.5, 0.3, 0.27, c.cream, sign * 1.05, -1.85, z);
      jaws.push(jaw);
    }
  }
  const m: Machine = {
    id: def.id,
    root,
    upper,
    boom,
    wire,
    tool,
    jaws,
    rotors,
    angle: def.id === 'cutter' ? 84 : def.id === 'crane' ? 57 : 68,
    slew: 0,
    cable: def.id === 'crane' ? 8 : 6,
    open: 0.35,
    spinning: false,
    speed: 0,
    length,
    trackParts,
    radius: 3.4,
    origin: root.position.clone(),
    originYaw: def.rotation,
  };
  updateMachine(m, 0);
  m.trackParts = [];
  batchParts(root, new Set([wire, ...rotors]));
  return m;
}
const machineTip = new T.Vector3();
export function updateMachine(m: Machine, dt: number) {
  if (m.id === 'truck') return;
  m.upper.rotation.y = m.slew;
  const a = T.MathUtils.degToRad(m.angle);
  m.boom.rotation.x = -(Math.PI / 2 - a);
  const tip = machineTip.set(
    0.4,
    1 + m.length * Math.sin(a),
    -1.3 - m.length * Math.cos(a),
  );
  const toolHeight = m.id === 'crane' ? 1.4 : 5.8;
  const maxCable = Math.max(1, tip.y + 1.5 - toolHeight - 0.6);
  m.cable = T.MathUtils.clamp(m.cable, 1, maxCable);
  m.wire.position.set(tip.x, tip.y - m.cable / 2, tip.z);
  m.wire.scale.y = m.cable;
  m.tool.position.set(tip.x, tip.y - m.cable, tip.z);
  m.tool.rotation.y = Math.sin(performance.now() * 0.0007) * 0.025;
  for (let i = 0; i < m.jaws.length; i++)
    m.jaws[i].rotation.z = (i === 0 ? -1 : 1) * m.open * 0.72;
  for (const r of m.rotors) if (m.spinning) r.rotateY(dt * 4);
  for (const t of m.trackParts) t.rotateY(m.speed * dt * 0.8);
}
export type Person = {
  root: T.Group;
  arms: T.Group[];
  legs: T.Group[];
  load: T.Object3D;
  role: string;
  route: number[][];
  target: number;
  wait: number;
  phase: number;
  moving: boolean;
};
export function createPerson(
  role: string,
  color: number,
  route: number[][],
  phase = 0,
): Person {
  const root = new T.Group();
  root.position.set(route[0][0], 0, route[0][1]);
  const torso = box(root, 0.7, 0.78, 0.4, color, 0, 1.35, 0);
  box(root, 0.11, 0.71, 0.43, c.cream, -0.19, 1.35, 0);
  box(root, 0.11, 0.71, 0.43, c.cream, 0.19, 1.35, 0);
  box(root, 0.72, 0.09, 0.43, c.cream, 0, 1.22, 0);
  mesh(new T.BoxGeometry(0.4, 0.42, 0.39), 0xcf9f75, root, 0, 1.95, 0);
  const hat = cylinder(
    root,
    0.32,
    0.22,
    role === '현장 감독' ? c.cream : c.yellow,
    0,
    2.2,
    0,
  );
  hat.scale.z *= 0.9;
  box(
    root,
    0.72,
    0.08,
    0.6,
    role === '현장 감독' ? c.white : c.yellow,
    0,
    2.1,
    -0.04,
  );
  const arms: T.Group[] = [],
    legs: T.Group[] = [];
  for (const side of [-1, 1]) {
    const a = new T.Group();
    a.position.set(side * 0.49, 1.65, 0);
    root.add(a);
    box(a, 0.22, 0.65, 0.23, 0x476c77, 0, -0.25, 0);
    box(a, 0.23, 0.2, 0.25, 0xcf9f75, 0, -0.62, 0);
    arms.push(a);
    const l = new T.Group();
    l.position.set(side * 0.21, 0.99, 0);
    root.add(l);
    box(l, 0.26, 0.7, 0.28, c.navy, 0, -0.3, 0);
    box(l, 0.31, 0.19, 0.45, c.dark, 0, -0.73, -0.07);
    legs.push(l);
  }
  const load = new T.Group();
  root.add(load);
  if (role === '자재 운반') {
    box(load, 0.9, 0.6, 0.65, 0xad8251, 0, 1.07, -0.58);
    box(load, 0.08, 0.63, 0.68, c.cream, 0, 1.07, -0.58);
  }
  if (role === '현장 감독') {
    box(load, 0.45, 0.58, 0.06, c.dark, 0.55, 1.3, -0.4);
    box(load, 0.38, 0.5, 0.07, c.cream, 0.55, 1.3, -0.43);
  }
  if (role === '신호수') {
    arms[1].add(load);
    load.position.set(0, -0.62, 0);
    beam(load, [0, 0, 0], [0, -0.95, 0], 0.03, c.cream);
    box(load, 0.52, 0.45, 0.04, c.orange, 0.24, -0.7, 0);
  }
  torso.name = 'vest';
  batchParts(root);
  return {
    root,
    arms,
    legs,
    load,
    role,
    route,
    target: 1 % route.length,
    wait: phase % 2,
    phase,
    moving: false,
  };
}
export function animatePerson(p: Person, t: number) {
  const swing = p.moving ? Math.sin(t * 8 + p.phase) * 0.55 : 0;
  p.legs[0].rotation.x = swing;
  p.legs[1].rotation.x = -swing;
  p.arms[0].rotation.x = p.role === '자재 운반' ? 1.1 : -swing * 0.8;
  p.arms[1].rotation.x =
    p.role === '자재 운반' ? 1.1 : p.role === '현장 감독' ? 0.7 : swing * 0.8;
  if (p.role === '신호수') {
    p.arms[1].rotation.z = 1.3 + Math.sin(t * 2.8 + p.phase) * 0.45;
    p.arms[1].rotation.x = 0.25;
    p.load.rotation.z = Math.PI - p.arms[1].rotation.z;
  }
  p.root.position.y = p.moving
    ? Math.abs(Math.sin(t * 8 + p.phase)) * 0.045
    : 0;
}
export function createWorkers() {
  const specs: [string, number, number[][]][] = [
    [
      '자재 운반',
      c.orange,
      [
        [-16, 40],
        [21, 40],
        [39, 40],
        [39, 51],
        [21, 51],
        [-16, 51],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [38, 29],
        [67, 29],
        [76, 22],
        [76, 13],
        [63, 13],
        [38, 29],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [-58, 25],
        [-47, 25],
        [-47, 33],
        [-58, 33],
      ],
    ],
    [
      '현장 감독',
      0xeee7d1,
      [
        [-19, 16],
        [12, 16],
        [38, 16],
        [38, 29],
        [-19, 29],
      ],
    ],
    [
      '현장 감독',
      0xeee7d1,
      [
        [36, -43],
        [-22, -43],
        [-33, -43],
        [-33, -28],
        [-33, -43],
      ],
    ],
    [
      '신호수',
      0xa4b856,
      [
        [-22, 23],
        [-19, 23],
      ],
    ],
    [
      '신호수',
      0xa4b856,
      [
        [46, 0],
        [50, 3],
      ],
    ],
    [
      '신호수',
      0xa4b856,
      [
        [-44, -18],
        [-45, -14],
      ],
    ],
    [
      '설비 점검',
      0x5e8390,
      [
        [-77, -30],
        [-62, -30],
        [-62, -33],
        [-77, -33],
      ],
    ],
    [
      '설비 점검',
      0x5e8390,
      [
        [47, -39],
        [50, -25],
        [48, -18],
        [47, -39],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [73, 50],
        [78, 46],
        [78, 29],
        [72, 27],
        [73, 50],
      ],
    ],
    [
      '현장 감독',
      0xeee7d1,
      [
        [-73, 58],
        [-48, 58],
        [-47, 38],
        [-45, 38],
        [-47, 58],
      ],
    ],
  ];
  const extras: [string, number, number[][]][] = [
    [
      '자재 운반',
      c.orange,
      [
        [-20, 44],
        [30, 44],
        [38, 54],
        [-20, 54],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [-42, 30],
        [-60, 30],
        [-60, 35],
        [-42, 35],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [44, 29],
        [68, 29],
        [76, 56],
        [44, 56],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [-80, 30],
        [-80, -25],
        [-76, -25],
        [-76, 30],
      ],
    ],
    [
      '설비 점검',
      0x5e8390,
      [
        [-35, 20],
        [-35, -46],
        [-31, -46],
        [-35, 20],
      ],
    ],
    [
      '설비 점검',
      0x5e8390,
      [
        [-30, -54],
        [36, -54],
        [36, -58],
        [-30, -58],
      ],
    ],
    [
      '현장 감독',
      0xeee7d1,
      [
        [40, 20],
        [40, 32],
        [19, 32],
        [19, 29],
        [40, 29],
      ],
    ],
    [
      '현장 감독',
      0xeee7d1,
      [
        [-47, 53],
        [-25, 53],
        [-25, 60],
        [-47, 60],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [38, 57],
        [73, 57],
        [73, 60],
        [38, 60],
      ],
    ],
    [
      '설비 점검',
      0x5e8390,
      [
        [80, -50],
        [80, -15],
        [82, -15],
        [82, -50],
      ],
    ],
    [
      '자재 운반',
      c.orange,
      [
        [-59, -28],
        [-75, -28],
        [-75, -32],
        [-59, -32],
      ],
    ],
    [
      '현장 감독',
      0xeee7d1,
      [
        [-19, 18],
        [14, 18],
        [14, 29],
        [-19, 29],
      ],
    ],
  ];
  return [...specs, ...extras].map(([r, color, route], i) =>
    createPerson(r, color, route, i * 1.8),
  );
}

function createTruck(def: (typeof equipment)[number]): Machine {
  const root = new T.Group();
  root.position.set(def.x, 0, def.z);
  root.rotation.y = def.rotation;
  box(root, 3.4, 0.7, 6.8, c.navy, 0, 1, 0);
  box(root, 3.2, 2.2, 2.4, c.cream, 0, 2.1, -2);
  box(root, 2.8, 1.15, 0.1, 0x527977, 0, 2.5, -3.25);
  box(root, 3.5, 0.2, 2.6, c.orange, 0, 3.3, -2);
  box(root, 3.3, 0.4, 4.2, 0x8e9c90, 0, 1.65, 1.3);
  for (const x of [-1.55, 1.55]) {
    box(root, 0.17, 0.8, 4.1, c.cream, x, 2.2, 1.3);
    box(root, 0.09, 1, 1.8, 0x527977, x * 1.04, 2.5, -2);
    box(root, 0.5, 0.3, 0.1, c.white, x * 0.8, 1.25, -3.46);
    box(root, 0.35, 0.23, 0.1, c.orange, x * 0.8, 1.2, 3.46);
  }
  box(root, 3.2, 0.8, 0.17, c.cream, 0, 2.2, 3.3);
  for (const x of [-1.8, 1.8])
    for (const z of [-2.1, 2.3]) {
      const tire = cylinder(root, 0.7, 0.38, c.dark, x, 0.8, z);
      tire.rotation.z = Math.PI / 2;
      const hub = cylinder(root, 0.3, 0.41, c.steel, x, 0.8, z);
      hub.rotation.z = Math.PI / 2;
    }
  batchParts(root);
  return {
    id: def.id,
    root,
    upper: new T.Group(),
    boom: new T.Group(),
    wire: new T.Mesh(),
    tool: new T.Group(),
    jaws: [],
    rotors: [],
    angle: 0,
    slew: 0,
    cable: 0,
    open: 0,
    spinning: false,
    speed: 0,
    length: 0,
    trackParts: [],
    radius: 3.5,
    origin: root.position.clone(),
    originYaw: def.rotation,
  };
}

// Each role shares five articulated instanced draws instead of dozens per person.
export function createCrowdRenderer(scene: T.Scene, people: Person[]) {
  const groups = new Map<string, { source: T.Mesh; person: Person }[]>();
  for (const person of people) {
    let part = 0;
    person.root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const key = `${person.role}:${part++}`;
      const list = groups.get(key) || [];
      list.push({ source: o, person });
      groups.set(key, list);
      o.visible = false;
    });
  }
  const batches = [...groups.values()].map((list) => {
    const mesh = new T.InstancedMesh(
      list[0].source.geometry,
      list[0].source.material,
      list.length,
    );
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, list };
  });
  const hidden = new T.Matrix4().makeScale(0, 0, 0);
  return () => {
    for (const p of people) p.root.updateMatrixWorld(true);
    for (const { mesh, list } of batches) {
      list.forEach(({ source, person }, i) =>
        mesh.setMatrixAt(i, person.root.visible ? source.matrixWorld : hidden),
      );
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

export type SiteTraffic = {
  root: T.Group;
  kind: 'forklift' | 'excavator';
  route: number[][];
  target: number;
  speed: number;
  moving: boolean;
  radius: number;
  wait: number;
};
export function createTraffic(): SiteTraffic[] {
  const routes: [SiteTraffic['kind'], number[][]][] = [
    [
      'forklift',
      [
        [-17, 35],
        [38, 35],
        [38, 48],
        [-17, 48],
      ],
    ],
    [
      'forklift',
      [
        [56, 20],
        [56, -46],
        [-38, -46],
        [-38, 35],
        [56, 35],
      ],
    ],
    [
      'excavator',
      [
        [-39, 20],
        [-39, -30],
        [-43, -30],
        [-43, 20],
      ],
    ],
    [
      'excavator',
      [
        [78, 28],
        [78, 54],
        [73, 54],
        [73, 28],
      ],
    ],
  ];
  return routes.map(([kind, route]) => {
    const root = new T.Group();
    root.position.set(route[0][0], 0, route[0][1]);
    const yellow = kind === 'forklift' ? 0xeeb447 : 0xdc8e3c;
    box(root, 2.2, 0.65, 3.4, yellow, 0, 0.9, 0);
    if (kind === 'forklift') {
      for (const x of [-1.12, 1.12])
        for (const z of [-1.1, 1.1]) {
          const tire = cylinder(root, 0.52, 0.35, c.dark, x, 0.56, z);
          tire.rotation.z = Math.PI / 2;
        }
      for (const x of [-0.85, 0.85]) {
        box(root, 0.12, 2.15, 0.14, c.navy, x, 2, -0.7);
        box(root, 0.12, 2.15, 0.14, c.navy, x, 2, 1);
        box(root, 0.14, 2.5, 0.18, c.steel, x, 1.9, -1.9);
        box(root, 0.24, 0.16, 1.4, c.steel, x, 0.72, -2.5);
      }
      box(root, 2.05, 0.16, 2.15, c.navy, 0, 3.15, 0.1);
      box(root, 1.55, 0.7, 1.1, 0xad8251, 0, 1.16, -2.5);
      box(root, 0.12, 0.73, 1.14, c.cream, 0, 1.16, -2.5);
      box(root, 0.72, 0.65, 0.5, c.navy, 0, 1.45, 0.7);
      box(root, 0.6, 0.6, 0.38, c.orange, 0, 1.95, 0.25);
      cylinder(root, 0.28, 0.2, c.yellow, 0, 2.65, 0.25);
      box(root, 0.37, 0.4, 0.35, 0xcf9f75, 0, 2.4, 0.25);
      beam(root, [-0.35, 2.1, 0.2], [-0.35, 1.75, -0.5], 0.11, 0x476c77);
      beam(root, [0.35, 2.1, 0.2], [0.35, 1.75, -0.5], 0.11, 0x476c77);
    } else {
      for (const x of [-1.1, 1.1]) {
        box(root, 0.65, 0.75, 3.4, c.dark, x, 0.5, 0);
        for (const z of [-1, 0, 1]) {
          const hub = cylinder(root, 0.3, 0.68, c.steel, x, 0.5, z);
          hub.rotation.z = Math.PI / 2;
        }
      }
      box(root, 2.2, 0.7, 2.3, yellow, 0, 1.35, 0.3);
      box(root, 1.2, 1.5, 1.5, c.cream, -0.5, 2.1, 0.15);
      box(root, 1.05, 0.95, 0.08, 0x527977, -0.5, 2.25, -0.63);
      box(root, 0.08, 0.95, 1.3, 0x527977, -1.13, 2.25, 0.15);
      box(root, 1.4, 0.16, 1.7, c.navy, -0.5, 2.92, 0.15);
      beam(root, [0.6, 1.7, -0.8], [0.6, 3.6, -2], 0.2, yellow);
      beam(root, [0.6, 3.6, -2], [0.6, 1.25, -3.1], 0.16, yellow);
      box(root, 1.1, 0.65, 0.9, c.dark, 0.6, 1, -3.1);
    }
    batchParts(root);
    return {
      root,
      kind,
      wait: 0,
      route,
      target: 1,
      speed: kind === 'forklift' ? 2.3 : 1.7,
      moving: false,
      radius: 2,
    };
  });
}
