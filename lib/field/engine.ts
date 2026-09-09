import * as T from 'three';
import { FrameBudget, renderScale } from './frame-budget';
import { registerFieldTools } from './webmcp';
import { createWorld, obstacles, soilPiles } from './world';
import {
  createMachine,
  updateMachine,
  createPerson,
  createWorkers,
  createTraffic,
  createCrowdRenderer,
  animatePerson,
  type Machine,
} from './actors';
import { equipment, zones, type EquipmentId } from './catalog';
import {
  intersectsRect,
  slideMove,
  cameraMovement,
  vehicleMotion,
  WALK_SPEED,
  RUN_SPEED,
} from './movement';
export type FieldState = {
  ready: boolean;
  mode: 'walk' | 'machine';
  viewPreference: 'top' | 'first';
  cameraMode: 'top' | 'first' | 'tps' | 'map';
  selected: EquipmentId | null;
  near: EquipmentId | null;
  speed: number;
  heading: number;
  boom: number;
  cable: number;
  jaw: number;
  active: boolean;
  x: number;
  z: number;
  zone: string;
  map: boolean;
  paused: boolean;
  workers: number;
  fps: number;
  waypoint: EquipmentId | null;
  distance: number;
  visited: EquipmentId[];
  error: string | null;
  labels: { id: string; text: string; x: number; y: number; type: string }[];
};
export class FieldEngine {
  frameBudget = new FrameBudget();
  cameraTarget = new T.Vector3();
  visibleLabels = new Set<string>();
  previousCpuMs = 0;
  previousRenderMs = 0;
  stalls: {
    atSeconds: number;
    gapMs: number;
    previousCpuMs: number;
    previousRenderMs: number;
  }[] = [];
  longTasks: { atSeconds: number; durationMs: number }[] = [];
  taskObserver: PerformanceObserver | null = null;
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  eyeCamera = new T.PerspectiveCamera(72, 1, 0.08, 500);
  firstPerson = false;
  lookYaw = 0;
  lookPitch = -0.06;
  freeLookEnabled = false;
  lockRequest = 0;
  lastCameraMode = '';
  tpsDistance = 13;
  tpsOrbit = 0;
  tpsYaw = 0;
  traffic = createTraffic();
  updateCrowd = () => {};
  labelElements = new Map<string, HTMLDivElement>();
  labelPoint = new T.Vector3();
  frameTimes = new Float32Array(3600);
  frameCount = 0;
  lastAudio = 0;
  lastShadow = 0;
  width = 1;
  height = 1;
  get cameraMode(): FieldState['cameraMode'] {
    return this.map
      ? 'map'
      : this.firstPerson
        ? this.selected
          ? 'tps'
          : 'first'
        : 'top';
  }
  get activeCamera() {
    return this.cameraMode === 'first' || this.cameraMode === 'tps'
      ? this.eyeCamera
      : this.camera;
  }
  renderer: T.WebGLRenderer;
  machines: Machine[] = [];
  workers = createWorkers();
  player = createPerson('입직자', 0xf27039, [[-29, 29]]);
  keys = new Set<string>();
  selected: Machine | null = null;
  near: Machine | null = null;
  map = false;
  paused = false;
  help = false;
  waypoint: EquipmentId | null = null;
  visited = new Set<EquipmentId>();
  azimuth = Math.PI / 4;
  targetAzimuth = Math.PI / 4;
  zoom = 65;
  zoomNow = 65;
  center = new T.Vector3();
  clock = 0;
  last = 0;
  raf = 0;
  lastEmit = 0;
  fps = 60;
  disposed = false;
  audio: AudioContext | null = null;
  gain: GainNode | null = null;
  osc: OscillatorNode | null = null;
  sound = false;
  resize: ResizeObserver;
  ring: T.Mesh;
  state!: FieldState;
  miniCtx: CanvasRenderingContext2D;
  contextLost = false;
  unregisterTools = () => {};
  constructor(
    public host: HTMLDivElement,
    public mini: HTMLCanvasElement,
    public emit: (s: FieldState) => void,
    public labelHost: HTMLDivElement,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      renderScale(host.clientWidth, host.clientHeight, window.devicePixelRatio),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setClearColor(0xbac6ab);
    this.host.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D 현장. WASD 이동, F 장비 탑승. H 도움말.',
    );
    this.scene.background = new T.Color(0xbac6ab);
    this.scene.fog = new T.Fog(0xbac6ab, 160, 350);
    this.scene.add(new T.HemisphereLight(0xe7f1e3, 0x8e744d, 2.4));
    const sun = new T.DirectionalLight(0xffdda2, 3.1);
    sun.position.set(-85, 61, -45);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -135,
      right: 135,
      top: 135,
      bottom: -135,
      near: 0.5,
      far: 350,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.08;
    this.scene.add(sun);
    this.scene.add(createWorld());
    for (const d of equipment) {
      const m = createMachine(d);
      this.machines.push(m);
      this.scene.add(m.root);
    }
    this.scene.add(this.player.root);
    this.player.root.scale.setScalar(1.25);
    for (const w of this.workers) {
      w.root.scale.setScalar(1.12);
      this.scene.add(w.root);
    }
    for (const vehicle of this.traffic) this.scene.add(vehicle.root);
    this.updateCrowd = createCrowdRenderer(this.scene, [
      this.player,
      ...this.workers,
    ]);
    this.ring = new T.Mesh(
      new T.RingGeometry(1, 1.2, 48),
      new T.MeshBasicMaterial({
        color: 0xf8eed0,
        transparent: true,
        opacity: 0.95,
        side: T.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.075;
    this.scene.add(this.ring);
    this.miniCtx = mini.getContext('2d')!;
    this.center.copy(this.player.root.position);
    this.camera.near = 0.1;
    this.camera.far = 500;
    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(host);
    this.onResize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    host.addEventListener('wheel', this.onWheel, { passive: false });
    host.addEventListener('pointerdown', this.onLookStart);
    host.addEventListener('pointermove', this.onLookMove);
    document.addEventListener('mousemove', this.onLockedLookMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    host.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.onContextLost,
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.onContextRestore,
    );
    this.frame(performance.now());
    if (
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes.includes('longtask')
    ) {
      this.taskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTasks.push({
            atSeconds: entry.startTime / 1000,
            durationMs: entry.duration,
          });
          if (this.longTasks.length > 30) this.longTasks.shift();
        }
      });
      this.taskObserver.observe({ type: 'longtask' });
    }
    this.unregisterTools = registerFieldTools(this);
    // Read-only state plus the same user commands; also a stable automation seam.
    (window as unknown as { pumyang: unknown }).pumyang = {
      getState: () => this.state,
      guide: (id: EquipmentId | null) => this.guideTo(id),
      map: () => this.toggleMap(),
      pause: () => this.togglePause(),
      reset: () => this.reset(),
      inspect: () => ({
        machines: this.machines.map((m) => ({
          id: m.id,
          x: m.root.position.x,
          z: m.root.position.z,
          angle: m.angle,
          slew: m.slew,
          cable: m.cable,
          open: m.open,
          spinning: m.spinning,
        })),
        workers: this.workers.map((w) => ({
          role: w.role,
          x: w.root.position.x,
          z: w.root.position.z,
          moving: w.moving,
        })),
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      }),
    };
  }
  onResize = () => {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(renderScale(w, h, window.devicePixelRatio));
    this.renderer.setSize(w, h);
    this.projection();
  };
  projection() {
    const a = this.width / this.height;
    this.camera.left = (-this.zoomNow * a) / 2;
    this.camera.right = (this.zoomNow * a) / 2;
    this.camera.top = this.zoomNow / 2;
    this.camera.bottom = -this.zoomNow / 2;
    this.camera.updateProjectionMatrix();
    this.eyeCamera.aspect = a;
    this.eyeCamera.updateProjectionMatrix();
  }
  onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.matches('input,textarea,select')) return;
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      )
    )
      e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Escape') {
        if (document.pointerLockElement === this.host) {
          this.endLook();
          return;
        }
        if (!this.help) this.setPaused(!this.paused);
        return;
      }
      if (e.code === 'KeyM' && !this.help && !this.paused) this.toggleMap();
      if (e.code === 'KeyC' && !this.help && !this.paused)
        if (this.cameraMode === 'first') this.lookBy(-Math.PI / 2, 0);
        else if (this.cameraMode === 'tps') this.tpsOrbit += Math.PI / 2;
        else this.targetAzimuth += Math.PI / 2;
      if (this.map || this.help || this.paused) return;
      if (e.code === 'KeyV') {
        this.toggleView();
        return;
      }
      if (e.code === 'KeyF' && !this.help && !this.paused) this.interact();
      if (
        e.code === 'KeyZ' &&
        this.selected?.id === 'cutter' &&
        !this.help &&
        !this.paused
      )
        this.selected.spinning = !this.selected.spinning;
    }
    if (!this.map && !this.help && !this.paused) this.keys.add(e.code);
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  onBlur = () => {
    this.keys.clear();
    this.endLook();
    if (this.selected) this.selected.speed = 0;
  };
  onVisibility = () => {
    this.onBlur();
  };
  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!this.map && !this.help && !this.paused) {
      if (this.cameraMode === 'tps')
        this.tpsDistance = T.MathUtils.clamp(
          this.tpsDistance + e.deltaY * 0.01,
          8,
          20,
        );
      else if (this.cameraMode === 'top')
        this.zoom = T.MathUtils.clamp(this.zoom + e.deltaY * 0.04, 36, 112);
    }
  };
  lookBy(yaw: number, pitch: number) {
    if (
      this.cameraMode !== 'first' ||
      this.paused ||
      this.help ||
      !Number.isFinite(yaw) ||
      !Number.isFinite(pitch)
    )
      return;
    this.lookYaw =
      T.MathUtils.euclideanModulo(this.lookYaw + yaw + Math.PI, Math.PI * 2) -
      Math.PI;
    this.lookPitch = T.MathUtils.clamp(this.lookPitch + pitch, -1.2, 1.1);
  }
  onLookStart = (e: PointerEvent) => {
    if (
      this.cameraMode !== 'first' ||
      this.paused ||
      this.help ||
      e.button !== 0
    )
      return;
    this.freeLookEnabled = true;
    this.requestLookLock();
  };
  requestLookLock() {
    if (
      this.cameraMode !== 'first' ||
      this.paused ||
      this.help ||
      this.disposed
    )
      return;
    this.renderer.domElement.focus({ preventScroll: true });
    const request = ++this.lockRequest;
    try {
      // A browser may require the user's click before pointer lock is available.
      // Ordinary mouse motion remains usable when lock is unavailable.
      Promise.resolve(this.host.requestPointerLock())
        .then(() => {
          if (
            request !== this.lockRequest ||
            this.cameraMode !== 'first' ||
            this.paused ||
            this.help ||
            this.disposed
          ) {
            if (document.pointerLockElement === this.host)
              document.exitPointerLock();
          }
        })
        .catch(() => {});
    } catch {
      /* The unlocked mouse-move fallback stays available. */
    }
  }
  onLookMove = (e: PointerEvent) => {
    if (
      document.pointerLockElement ||
      !this.freeLookEnabled ||
      e.pointerType === 'touch'
    )
      return;
    this.lookBy(-e.movementX * 0.0035, -e.movementY * 0.0035);
  };
  onLockedLookMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.host) return;
    this.lookBy(-e.movementX * 0.0035, -e.movementY * 0.0035);
  };
  onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.host;
    this.host.classList.toggle('looking', locked);
    if (!locked) {
      this.keys.clear();
      this.freeLookEnabled = false;
    }
  };
  endLook() {
    ++this.lockRequest;
    this.freeLookEnabled = false;
    this.host.classList.remove('looking');
    if (document.pointerLockElement === this.host) document.exitPointerLock();
  }
  onContextMenu = (e: MouseEvent) => {
    if (this.cameraMode === 'first') e.preventDefault();
  };
  toggleView() {
    if (this.map || this.paused || this.help) return;
    this.endLook();
    this.keys.clear();
    this.firstPerson = !this.firstPerson;
    if (this.firstPerson && !this.selected) {
      this.lookYaw = this.player.root.rotation.y;
      this.lookPitch = -0.06;
      this.freeLookEnabled = true;
      this.requestLookLock();
    }
    if (this.selected) this.selected.speed = 0;
    this.publish();
  }
  onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.keys.clear();
    this.emit({ ...this.state, error: 'WebGL context lost' });
  };
  onContextRestore = () => {
    this.contextLost = false;
  };
  guideTo(id: EquipmentId | null) {
    if (id && !equipment.some((e) => e.id === id)) return;
    this.waypoint = id;
    this.publish();
  }
  toggleMap() {
    if (this.help || this.paused) return;
    this.map = !this.map;
    this.endLook();
    this.freeLookEnabled = this.cameraMode === 'first';
    this.keys.clear();
    if (this.selected) this.selected.speed = 0;
    this.publish();
  }
  centerCamera() {
    this.targetAzimuth = Math.PI / 4;
    this.zoom = 65;
    this.tpsDistance = 13;
    this.tpsOrbit = 0;
    this.lookPitch = -0.06;
    this.map = false;
  }
  setHelp(v: boolean) {
    this.help = v;
    this.endLook();
    this.freeLookEnabled = !v && !this.paused && this.cameraMode === 'first';
    this.keys.clear();
    if (this.selected) this.selected.speed = 0;
  }
  togglePause() {
    this.setPaused(!this.paused);
  }
  setPaused(v: boolean) {
    this.paused = v;
    this.endLook();
    this.freeLookEnabled = !v && !this.help && this.cameraMode === 'first';
    this.keys.clear();
    if (this.selected) this.selected.speed = 0;
    this.publish();
  }
  emitEvent(name: string, detail: object) {
    window.dispatchEvent(
      new CustomEvent('pumyang:simulation', {
        detail: { name, time: this.clock, ...detail },
      }),
    );
  }
  blocked(x: number, z: number, r: number, ignore?: Machine) {
    if (Math.abs(x) > 85 - r || Math.abs(z) > 64 - r) return true;
    if (obstacles.some((b) => intersectsRect(x, z, r, b))) return true;
    if (soilPiles.some((p) => Math.hypot(x - p.x, z - p.z) < r + p.r))
      return true;
    if (
      this.traffic.some(
        (v) =>
          Math.hypot(x - v.root.position.x, z - v.root.position.z) <
          r + v.radius,
      )
    )
      return true;
    return this.machines.some(
      (m) =>
        m !== ignore &&
        Math.hypot(x - m.root.position.x, z - m.root.position.z) < r + m.radius,
    );
  }
  interact() {
    if (this.paused || this.help || this.map) return;
    this.endLook();
    if (this.selected) {
      const m = this.selected;
      for (let i = 0; i < 16; i++) {
        const a = m.root.rotation.y + (i * Math.PI) / 8;
        const x = m.root.position.x + Math.cos(a) * 5.4,
          z = m.root.position.z + Math.sin(a) * 5.4;
        if (!this.blocked(x, z, 0.65)) {
          this.player.root.position.set(x, 0, z);
          this.player.root.visible = true;
          m.speed = 0;
          m.spinning = false;
          this.selected = null;
          this.freeLookEnabled = this.firstPerson;
          if (this.firstPerson) this.requestLookLock();
          this.keys.clear();
          this.emitEvent('equipment-exited', { id: m.id });
          this.publish();
          return;
        }
      }
      return;
    }
    this.updateNear();
    if (this.near) {
      this.selected = this.near;
      this.tpsOrbit = 0;
      this.visited.add(this.near.id);
      this.player.root.visible = false;
      this.waypoint = null;
      this.keys.clear();
      this.emitEvent('equipment-entered', { id: this.near.id });
      this.publish();
    }
  }
  reset() {
    this.selected = null;
    this.near = null;
    this.player.root.visible = true;
    this.player.root.position.set(-29, 0, 29);
    this.lookYaw = 0;
    this.lookPitch = -0.06;
    this.endLook();
    this.keys.clear();
    this.paused = false;
    this.map = false;
    this.waypoint = null;
    this.visited.clear();
    for (const v of this.traffic) {
      v.root.position.set(v.route[0][0], 0, v.route[0][1]);
      v.target = 1;
      v.wait = 0;
    }
    for (const m of this.machines) {
      m.root.position.copy(m.origin);
      m.root.rotation.y = m.originYaw;
      m.speed = 0;
      m.slew = 0;
      m.angle = m.id === 'cutter' ? 84 : m.id === 'crane' ? 57 : 68;
      m.cable = m.id === 'crane' ? 8 : 6;
      m.open = 0.35;
      m.spinning = false;
      updateMachine(m, 0);
    }
    this.centerCamera();
    this.center.copy(this.player.root.position);
    this.publish();
  }
  updateNear() {
    this.near = null;
    let distance = 8.3;
    for (const m of this.machines) {
      const d = m.root.position.distanceTo(this.player.root.position);
      if (d < distance) {
        this.near = m;
        distance = d;
      }
    }
  }
  input(a: string, b: string) {
    return Number(this.keys.has(a)) - Number(this.keys.has(b));
  }
  simulate(dt: number) {
    if (this.selected) {
      const m = this.selected,
        truck = m.id === 'truck',
        stop = this.keys.has('Space'),
        drive = this.input('KeyW', 'KeyS');
      const motion = vehicleMotion(
        m.speed,
        drive,
        this.input('KeyA', 'KeyD'),
        stop,
        truck,
        dt,
      );
      m.speed = motion.speed;
      if (!stop) {
        m.root.rotation.y += motion.yaw;
        const dx = -Math.sin(m.root.rotation.y) * m.speed * dt,
          dz = -Math.cos(m.root.rotation.y) * m.speed * dt;
        const old = m.root.position.clone();
        const next = slideMove(
          old.x,
          old.z,
          dx,
          dz,
          (x, z) =>
            this.blocked(x, z, m.radius, m) ||
            this.workers.some(
              (w) =>
                Math.hypot(w.root.position.x - x, w.root.position.z - z) <
                m.radius + 1,
            ),
        );
        m.root.position.set(next.x, 0, next.z);
        if (
          Math.hypot(next.x - old.x, next.z - old.z) <
          Math.hypot(dx, dz) * 0.5
        )
          m.speed = 0;
        if (!truck) {
          m.slew += this.input('KeyQ', 'KeyE') * 0.42 * dt;
          m.angle = T.MathUtils.clamp(
            m.angle + this.input('ArrowUp', 'ArrowDown') * 15 * dt,
            m.id === 'cutter' ? 75 : 35,
            m.id === 'cutter' ? 89 : 80,
          );
          m.cable += this.input('KeyG', 'KeyT') * 2.2 * dt;
          if (m.id === 'grab')
            m.open = T.MathUtils.clamp(
              m.open + this.input('KeyX', 'KeyZ') * dt,
              0,
              1,
            );
        }
      } else m.spinning = false;
      updateMachine(m, dt);
    } else {
      if (this.firstPerson)
        this.lookBy(
          this.input('ArrowLeft', 'ArrowRight') * 1.5 * dt,
          this.input('ArrowUp', 'ArrowDown') * dt,
        );
      const move = cameraMovement(
        this.input('KeyD', 'KeyA'),
        this.input('KeyS', 'KeyW'),
        this.firstPerson ? this.lookYaw : this.azimuth,
      );
      const speed =
        this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
          ? RUN_SPEED
          : WALK_SPEED;
      const old = this.player.root.position;
      const n = slideMove(
        old.x,
        old.z,
        move.x * speed * dt,
        move.z * speed * dt,
        (x, z) => this.blocked(x, z, 0.7),
      );
      this.player.moving = Math.hypot(n.x - old.x, n.z - old.z) > 0.001;
      old.x = n.x;
      old.z = n.z;
      if (this.firstPerson) this.player.root.rotation.y = this.lookYaw;
      else if (this.player.moving)
        this.player.root.rotation.y = Math.atan2(-move.x, -move.z);
      animatePerson(this.player, this.clock);
      this.updateNear();
    }

    const playerPos = this.selected
      ? this.selected.root.position
      : this.player.root.position;
    for (const v of this.traffic) {
      const goal = v.route[v.target];
      const dx = goal[0] - v.root.position.x,
        dz = goal[1] - v.root.position.z;
      const distance = Math.hypot(dx, dz);
      v.moving = false;
      if (distance < 0.6) {
        v.target = (v.target + 1) % v.route.length;
        continue;
      }
      const vx = dx / distance,
        vz = dz / distance;
      const x = v.root.position.x + vx * v.speed * dt,
        z = v.root.position.z + vz * v.speed * dt;
      const aheadX = x + vx * 1.4,
        aheadZ = z + vz * 1.4;
      const blocked =
        obstacles.some((b) => intersectsRect(x, z, v.radius, b)) ||
        soilPiles.some((p) => Math.hypot(x - p.x, z - p.z) < v.radius + p.r) ||
        this.machines.some(
          (m) =>
            Math.hypot(x - m.root.position.x, z - m.root.position.z) <
            v.radius + m.radius + 0.3,
        ) ||
        this.traffic.some(
          (o) =>
            o !== v &&
            Math.hypot(x - o.root.position.x, z - o.root.position.z) <
              v.radius + o.radius + 0.3,
        ) ||
        this.workers.some(
          (w) =>
            Math.hypot(aheadX - w.root.position.x, aheadZ - w.root.position.z) <
            v.radius + 0.8,
        ) ||
        (!this.selected &&
          Math.hypot(aheadX - playerPos.x, aheadZ - playerPos.z) <
            v.radius + 1.3);
      if (blocked) {
        v.wait += dt;
        if (v.wait > 4) {
          v.route.reverse();
          v.target = (v.route.length - v.target) % v.route.length;
          v.wait = 0;
        }
      } else {
        v.wait = 0;
        v.root.position.set(x, 0, z);
        const wanted = Math.atan2(-vx, -vz);
        v.root.rotation.y +=
          Math.atan2(
            Math.sin(wanted - v.root.rotation.y),
            Math.cos(wanted - v.root.rotation.y),
          ) *
          (1 - Math.exp(-5 * dt));
        v.moving = true;
      }
    }
    for (const w of this.workers) {
      w.moving = false;
      if (w.wait > 0) {
        w.wait -= dt;
      } else {
        const target = w.route[w.target],
          dx = target[0] - w.root.position.x,
          dz = target[1] - w.root.position.z,
          dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          w.target = (w.target + 1) % w.route.length;
          w.wait =
            w.role === '신호수' ? 3 : w.role === '현장 감독' ? 1.8 : 0.55;
        } else {
          let vx = dx / dist,
            vz = dz / dist;
          for (const other of this.workers) {
            if (other === w) continue;
            const ox = w.root.position.x - other.root.position.x,
              oz = w.root.position.z - other.root.position.z,
              d = Math.hypot(ox, oz);
            if (d > 0 && d < 1.2) {
              vx += (ox / d) * 0.65;
              vz += (oz / d) * 0.65;
            }
          }
          for (const vehicle of this.traffic) {
            const ox = w.root.position.x - vehicle.root.position.x;
            const oz = w.root.position.z - vehicle.root.position.z;
            const distance = Math.hypot(ox, oz);
            if (distance > 0 && distance < 5) {
              const strength = (5 - distance) * 0.6;
              vx += (ox / distance) * strength;
              vz += (oz / distance) * strength;
            }
          }
          const v = Math.hypot(vx, vz) || 1;
          vx /= v;
          vz /= v;
          const n = slideMove(
            w.root.position.x,
            w.root.position.z,
            vx * 1.45 * dt,
            vz * 1.45 * dt,
            (x, z) =>
              this.blocked(x, z, 0.55) ||
              Math.hypot(x - playerPos.x, z - playerPos.z) <
                (this.selected ? this.selected.radius + 1 : 1.25),
          );
          w.moving =
            Math.hypot(n.x - w.root.position.x, n.z - w.root.position.z) >
            0.001;
          w.root.position.x = n.x;
          w.root.position.z = n.z;
          if (w.moving) w.root.rotation.y = Math.atan2(-vx, -vz);
        }
      }
      animatePerson(w, this.clock);
    }
  }
  frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) {
      this.last = 0;
      return;
    }
    if (!this.frameBudget.take(now)) return;
    const cpuStart = performance.now();
    const elapsed = this.last ? (now - this.last) / 1000 : 1 / 60,
      dt = Math.min(elapsed, 0.05);
    this.last = now;
    if (!this.help && !this.paused) {
      this.frameTimes[this.frameCount++ % this.frameTimes.length] =
        elapsed * 1000;
      if (elapsed > 0.05) {
        this.stalls.push({
          atSeconds: now / 1000,
          gapMs: elapsed * 1000,
          previousCpuMs: this.previousCpuMs,
          previousRenderMs: this.previousRenderMs,
        });
        if (this.stalls.length > 30) this.stalls.shift();
      }
    }
    this.fps = T.MathUtils.lerp(this.fps, 1 / Math.max(elapsed, 0.001), 0.02);
    if (!this.paused && !this.help && !document.hidden) {
      this.clock += dt;
      this.simulate(dt);
    }
    this.azimuth = T.MathUtils.damp(this.azimuth, this.targetAzimuth, 7, dt);
    const focus = this.selected?.root.position || this.player.root.position;
    const view = this.cameraMode;
    const changed = this.lastCameraMode !== view;
    const forward = this.labelPoint.set(
      -Math.sin(this.azimuth),
      0,
      -Math.cos(this.azimuth),
    );
    const target = this.map
      ? this.cameraTarget.set(0, 0, -5)
      : this.cameraTarget
          .copy(focus)
          .addScaledVector(forward, this.selected ? 4 : 9);
    const wantedZoom = this.map ? 192 : this.zoom;
    if (changed) {
      this.center.copy(target);
      this.zoomNow = wantedZoom;
      (this.scene.background as T.Color).setHex(
        view === 'first' || view === 'tps' ? 0xbccfd1 : 0xbac6ab,
      );
      (this.scene.fog as T.Fog).color.copy(this.scene.background as T.Color);
      this.lastCameraMode = view;
      this.eyeCamera.fov = view === 'tps' ? 62 : 72;
      this.eyeCamera.updateProjectionMatrix();
    } else {
      this.center.lerp(target, 1 - Math.exp(-5 * dt));
      this.zoomNow = T.MathUtils.damp(this.zoomNow, wantedZoom, 6, dt);
    }
    this.projection();
    this.camera.position.set(
      this.center.x + Math.sin(this.azimuth) * 75,
      this.center.y + 90,
      this.center.z + Math.cos(this.azimuth) * 75,
    );
    this.camera.lookAt(this.center);
    if (view === 'first') {
      this.eyeCamera.position.set(focus.x, 2.25, focus.z);
      this.eyeCamera.lookAt(
        focus.x - Math.sin(this.lookYaw) * Math.cos(this.lookPitch),
        2.25 + Math.sin(this.lookPitch),
        focus.z - Math.cos(this.lookYaw) * Math.cos(this.lookPitch),
      );
    } else if (view === 'tps' && this.selected) {
      const wantedYaw = this.selected.root.rotation.y + this.tpsOrbit;
      this.tpsYaw = changed
        ? wantedYaw
        : this.tpsYaw +
          Math.atan2(
            Math.sin(wantedYaw - this.tpsYaw),
            Math.cos(wantedYaw - this.tpsYaw),
          ) *
            (1 - Math.exp(-6 * dt));
      const truck = this.selected.id === 'truck';
      const distance = this.tpsDistance * (truck ? 0.78 : 1);
      const y = truck ? 6.5 : 8.5;
      const eye = this.labelPoint.set(
        focus.x + Math.sin(this.tpsYaw) * distance,
        y,
        focus.z + Math.cos(this.tpsYaw) * distance,
      );
      if (changed) this.eyeCamera.position.copy(eye);
      else this.eyeCamera.position.lerp(eye, 1 - Math.exp(-9 * dt));
      this.eyeCamera.lookAt(
        focus.x - Math.sin(this.tpsYaw) * (truck ? 2.5 : 3.5),
        truck ? 1.4 : 1.8,
        focus.z - Math.cos(this.tpsYaw) * (truck ? 2.5 : 3.5),
      );
    }
    this.player.root.visible = !this.selected && view !== 'first';
    this.ring.visible = view !== 'first' && view !== 'tps';
    this.ring.position.x = focus.x;
    this.ring.position.z = focus.z;
    this.ring.scale.setScalar(this.selected ? 4 : 1);
    (this.ring.material as T.MeshBasicMaterial).color.setHex(
      this.selected ? 0xf2b660 : 0xfff7d3,
    );
    this.updateCrowd();
    if (now - this.lastShadow > 65) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadow = now;
    }
    const renderStart = performance.now();
    if (!this.contextLost) this.renderer.render(this.scene, this.activeCamera);
    this.previousRenderMs = performance.now() - renderStart;
    this.updateLabels();
    if (now - this.lastEmit > 125) {
      this.lastEmit = now;
      this.publish();
      this.drawMini();
    }
    if (this.gain && this.audio && now - this.lastAudio > 125) {
      this.lastAudio = now;
      this.gain.gain.cancelScheduledValues(this.audio.currentTime);
      this.osc?.frequency.cancelScheduledValues(this.audio.currentTime);
      this.gain.gain.setTargetAtTime(
        this.sound && !this.paused && !this.help ? 0.015 : 0,
        this.audio.currentTime,
        0.2,
      );
      if (this.osc)
        this.osc.frequency.setTargetAtTime(
          this.selected ? 42 + Math.abs(this.selected.speed) * 14 : 38,
          this.audio.currentTime,
          0.2,
        );
    }
    this.previousCpuMs = performance.now() - cpuStart;
  };
  performanceStats() {
    const samples = Array.from(
      this.frameTimes.subarray(
        0,
        Math.min(this.frameCount, this.frameTimes.length),
      ),
    ).sort((a, b) => a - b);
    return {
      samples: samples.length,
      medianMs: samples[Math.floor(samples.length * 0.5)] || 0,
      p95Ms: samples[Math.floor(samples.length * 0.95)] || 0,
      maxMs: samples.at(-1) || 0,
      over500Ms: samples.filter((n) => n > 500).length,
      over50Ms: samples.filter((n) => n > 50).length,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }
  updateLabels() {
    const focus = this.selected?.root.position || this.player.root.position;
    // DOM membership is stable. Only compositor transforms change at display rate.
    this.visibleLabels.clear();
    if (this.map) {
      for (const element of this.labelElements.values())
        if (!element.hidden) element.hidden = true;
      return;
    }
    const project = (
      id: string,
      text: string,
      pos: T.Vector3,
      height: number,
      type: string,
    ) => {
      const n = this.labelPoint.copy(pos);
      n.y += height;
      n.project(this.activeCamera);
      const x = (n.x * 0.5 + 0.5) * this.width,
        y = (-n.y * 0.5 + 0.5) * this.height;
      if (
        n.z <= -1 ||
        n.z >= 1 ||
        x < 25 ||
        x > this.width - 25 ||
        y < 130 ||
        y > this.height - 120
      )
        return;
      let element = this.labelElements.get(id);
      if (!element) {
        element = document.createElement('div');
        element.className = `world-label ${type}`;
        element.textContent = text;
        this.labelHost.appendChild(element);
        this.labelElements.set(id, element);
      }
      this.visibleLabels.add(id);
      if (element.hidden) element.hidden = false;
      element.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-100%)`;
    };
    if (!this.selected && this.cameraMode !== 'first')
      project('you', 'YOU', focus, 3.6, 'player');
    for (const m of this.machines)
      if (
        m !== this.selected &&
        m.root.position.distanceToSquared(focus) < 1296
      )
        project(
          m.id,
          equipment.find((e) => e.id === m.id)!.name,
          m.root.position,
          5.2,
          'machine',
        );
    this.workers.forEach((w, i) => {
      if (w.root.position.distanceToSquared(focus) < 225)
        project(`worker${i}`, w.role, w.root.position, 3.1, 'worker');
    });
    for (const [id, element] of this.labelElements)
      if (!this.visibleLabels.has(id) && !element.hidden) element.hidden = true;
  }
  diagnostics() {
    const gl = this.renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      revision: 'chrome-performance-1',
      browser: navigator.userAgent,
      viewport: [this.width, this.height],
      pixelRatio: this.renderer.getPixelRatio(),
      gpu: String(
        gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      ),
      view: this.cameraMode,
      ...this.performanceStats(),
      stalls: this.stalls,
      longTasks: this.longTasks,
    };
  }
  publish() {
    const m = this.selected,
      p = m?.root.position || this.player.root.position;
    let closest = zones[0],
      d = Infinity;
    for (const z of zones) {
      const v = Math.hypot(p.x - z.x, p.z - z.z);
      if (v < d) {
        d = v;
        closest = z;
      }
    }
    this.state = {
      ready: true,
      mode: m ? 'machine' : 'walk',
      viewPreference: this.firstPerson ? 'first' : 'top',
      cameraMode: this.cameraMode,
      selected: m?.id || null,
      near: this.near?.id || null,
      speed: Math.abs(m?.speed || 0) * 3.6,
      heading:
        ((T.MathUtils.radToDeg(
          m?.id === 'truck' ? m.root.rotation.y : m?.slew || 0,
        ) %
          360) +
          360) %
        360,
      boom: m?.angle || 0,
      cable: m?.cable || 0,
      jaw: m?.open || 0,
      active:
        !!m &&
        (Math.abs(m.speed) > 0.1 ||
          m.spinning ||
          [
            'KeyQ',
            'KeyE',
            'ArrowUp',
            'ArrowDown',
            'KeyT',
            'KeyG',
            'KeyZ',
            'KeyX',
          ].some((k) => this.keys.has(k))),
      x: p.x,
      z: p.z,
      zone: closest.name,
      map: this.map,
      paused: this.paused,
      workers: this.workers.length,
      fps: Math.round(this.fps),
      waypoint: this.waypoint,
      distance: this.waypoint
        ? this.machines
            .find((m) => m.id === this.waypoint)!
            .root.position.distanceTo(p)
        : 0,
      visited: [...this.visited],
      error: this.contextLost ? 'WebGL context lost' : null,
      labels: [],
    };
    this.emit(this.state);
  }
  drawMini() {
    const ctx = this.miniCtx;
    const w = this.mini.width,
      h = this.mini.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e1e7d5';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    const scale = 2.1;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#c5b58f';
    ctx.fillRect(-90, -70, 180, 140);
    ctx.fillStyle = '#929a87';
    ctx.fillRect(-90, 29, 180, 10);
    ctx.fillRect(-44, -65, 10, 130);
    ctx.fillRect(51, -62, 9, 121);
    ctx.fillRect(-75, -51, 150, 8);
    ctx.fillStyle = '#9a987e';
    ctx.fillRect(-28, -38, 70, 50);
    ctx.strokeStyle = '#e9e4ca';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(-28, -38, 70, 50);
    for (let z = -32; z < 10; z += 8) {
      ctx.beginPath();
      ctx.moveTo(-28, z);
      ctx.lineTo(42, z);
      ctx.stroke();
    }
    ctx.fillStyle = '#526d65';
    ctx.fillRect(-76, 40, 26, 11);
    ctx.fillStyle = '#d7ccab';
    ctx.fillRect(-76, -57, 25, 21);
    ctx.fillStyle = '#687871';
    ctx.fillRect(45, 36, 24, 16);
    for (const worker of this.workers) {
      ctx.fillStyle = '#f3f1dd';
      ctx.beginPath();
      ctx.arc(
        worker.root.position.x,
        worker.root.position.z,
        0.9,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      ctx.fillStyle = this.waypoint === m.id ? '#ed7038' : '#35564d';
      ctx.beginPath();
      ctx.arc(m.root.position.x, m.root.position.z, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff9e0';
      ctx.font = 'bold 4.8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), m.root.position.x, m.root.position.z + 1.6);
    }
    const p = this.selected?.root.position || this.player.root.position;
    ctx.translate(p.x, p.z);
    ctx.rotate(this.selected?.root.rotation.y || this.player.root.rotation.y);
    ctx.fillStyle = '#fa7640';
    ctx.strokeStyle = '#fffce6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(2.8, 3.2);
    ctx.lineTo(0, 1.8);
    ctx.lineTo(-2.8, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#617665';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('N ↑', w - 15, 23);
  }
  setSound(on: boolean) {
    this.sound = on;
    if (on && !this.audio) {
      this.audio = new AudioContext();
      this.osc = this.audio.createOscillator();
      this.osc.type = 'triangle';
      this.gain = this.audio.createGain();
      this.gain.gain.value = 0;
      this.osc.connect(this.gain);
      this.gain.connect(this.audio.destination);
      this.osc.start();
    }
    if (on) void this.audio?.resume().catch(() => {});
  }
  dispose() {
    this.disposed = true;
    this.unregisterTools();
    this.taskObserver?.disconnect();
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.endLook();
    this.host.removeEventListener('wheel', this.onWheel);
    this.host.removeEventListener('pointerdown', this.onLookStart);
    this.host.removeEventListener('pointermove', this.onLookMove);
    document.removeEventListener('mousemove', this.onLockedLookMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.host.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.onContextLost,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.onContextRestore,
    );
    void this.audio?.close().catch(() => {});
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        gs.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          ms.add(m);
      }
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => {
      if ('map' in m && (m as T.MeshBasicMaterial).map)
        (m as T.MeshBasicMaterial).map!.dispose();
      m.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelHost.replaceChildren();
    this.labelElements.clear();
    delete (window as unknown as { pumyang?: unknown }).pumyang;
  }
}
