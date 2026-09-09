import type { FieldEngine } from './engine';

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (tool: Tool, options: { signal: AbortSignal }) => unknown;
};
const controls = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyT',
  'KeyG',
  'KeyZ',
  'KeyX',
  'Space',
];

/** Optional browser-native tools, using precisely the keyboard/UI action path. */
export function registerFieldTools(engine: FieldEngine) {
  const lifecycle = new AbortController();
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const read = () => ({
    mode: engine.state.mode,
    viewPreference: engine.state.viewPreference,
    cameraMode: engine.cameraMode,
    look: { yaw: engine.lookYaw, pitch: engine.lookPitch },
    cameraPosition: engine.activeCamera.position.toArray(),
    playerVisible: engine.player.root.visible,
    selected: engine.state.selected,
    near: engine.state.near,
    x: engine.state.x,
    z: engine.state.z,
    paused: engine.paused,
    help: engine.help,
    map: engine.map,
    waypoint: engine.waypoint,
    fps: engine.state.fps,
    machines: engine.machines.map((m) => ({
      id: m.id,
      speed: m.speed,
      heading: m.root.rotation.y,
      x: m.root.position.x,
      z: m.root.position.z,
      boom: m.angle,
      slew: m.slew,
      cable: m.cable,
      jaw: m.open,
      spinning: m.spinning,
    })),
    workers: engine.workers.map((w) => ({
      role: w.role,
      x: w.root.position.x,
      z: w.root.position.z,
      moving: w.moving,
    })),
    performance: engine.performanceStats(),
    diagnostics: engine.diagnostics(),
    traffic: engine.traffic.map((v) => ({
      kind: v.kind,
      x: v.root.position.x,
      z: v.root.position.z,
      moving: v.moving,
    })),
    drawCalls: engine.renderer.info.render.calls,
    triangles: engine.renderer.info.render.triangles,
  });
  const parse = (input: unknown, allowed: string[]) => {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => !allowed.includes(k))
    )
      throw Error('Invalid fields');
    return input as Record<string, unknown>;
  };
  let busy = false;
  const tools: Tool[] = [
    {
      name: 'read_field_state',
      description:
        'Read current equipment, trainee and worker positions and simulation status.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        parse(input, []);
        return read();
      },
    },
    {
      name: 'navigate_field',
      description:
        'Show a machine waypoint, toggle the full map or first-person mode, or restore the camera. First-person mode uses close rear TPS aboard equipment. Same actions as the visible field controls.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: ['crane', 'cutter', 'grab', 'truck', 'map', 'camera', 'view'],
          },
        },
        required: ['target'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      async execute(input) {
        const { target } = parse(input, ['target']);
        if (
          ![
            'crane',
            'cutter',
            'grab',
            'truck',
            'map',
            'camera',
            'view',
          ].includes(String(target))
        )
          throw Error('Unknown destination');
        if (target === 'map') engine.toggleMap();
        else if (target === 'camera') engine.centerCamera();
        else if (target === 'view') engine.toggleView();
        else engine.guideTo(target as 'crane' | 'cutter' | 'grab' | 'truck');
        engine.publish();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return read();
      },
    },
    {
      name: 'interact_with_equipment',
      description:
        'Board a nearby machine or leave the currently occupied machine, equivalent to F. Requires proximity and an unpaused walking or machinery view.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      async execute(input) {
        parse(input, []);
        if (engine.paused || engine.help || engine.map)
          throw Error('Close overlays and resume first');
        engine.updateNear();
        if (!engine.selected && !engine.near)
          throw Error('No equipment within boarding distance');
        engine.interact();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return read();
      },
    },
    {
      name: 'hold_field_controls',
      description:
        'Hold actual walking or equipment keyboard controls for 1–2000 milliseconds. Keys use browser KeyboardEvent codes. WASD moves, ShiftLeft runs; first-person walking: arrows look around; aboard: Q/E slews, ArrowUp/Down adjusts boom, T/G raises/lowers, Z/X operates tool, Space stops. Time advances normally; collision rules always apply.',
      inputSchema: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string', enum: controls },
            minItems: 1,
            maxItems: 4,
            uniqueItems: true,
          },
          duration_ms: { type: 'integer', minimum: 1, maximum: 2000 },
        },
        required: ['keys', 'duration_ms'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      async execute(input) {
        const { keys, duration_ms } = parse(input, ['keys', 'duration_ms']);
        if (
          !Array.isArray(keys) ||
          keys.length < 1 ||
          keys.length > 4 ||
          keys.some((k) => !controls.includes(k)) ||
          new Set(keys).size !== keys.length ||
          !Number.isInteger(duration_ms) ||
          Number(duration_ms) < 1 ||
          Number(duration_ms) > 2000
        )
          throw Error('Invalid controls or duration');
        if (busy || engine.paused || engine.help || engine.map)
          throw Error('Controls unavailable while busy or an overlay is open');
        busy = true;
        try {
          for (const code of keys)
            engine.onKeyDown(new KeyboardEvent('keydown', { code }));
          await new Promise((resolve) =>
            setTimeout(resolve, Number(duration_ms)),
          );
        } finally {
          for (const code of keys)
            engine.onKeyUp(new KeyboardEvent('keyup', { code }));
          busy = false;
        }
        if (lifecycle.signal.aborted) throw Error('Scene closed');
        engine.publish();
        return read();
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Ordinary browsers do not require WebMCP. */
    }
  }
  return () => {
    lifecycle.abort();
    engine.keys.clear();
  };
}
