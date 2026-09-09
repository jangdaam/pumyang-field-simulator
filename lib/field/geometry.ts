import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const materials = new Map<number, T.MeshStandardMaterial>();
export const palette = {
  earth: 0xcab48c,
  soil: 0xa58c65,
  cut: 0x947954,
  grass: 0x849777,
  road: 0x9b9985,
  cream: 0xeee9d3,
  white: 0xf5f2df,
  navy: 0x304d50,
  steel: 0x536567,
  dark: 0x293d3f,
  orange: 0xe8813e,
  yellow: 0xe7b849,
  tree: 0x66805b,
};
export function mat(color: number) {
  if (!materials.has(color))
    materials.set(
      color,
      new T.MeshStandardMaterial({
        color,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      }),
    );
  return materials.get(color)!;
}
export function mesh(
  g: T.BufferGeometry,
  color: number,
  parent: T.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const boxGeo = new T.BoxGeometry(1, 1, 1),
  cylinderGeo = new T.CylinderGeometry(1, 1, 1, 10);
export function box(
  p: T.Object3D,
  w: number,
  h: number,
  d: number,
  c: number,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = mesh(boxGeo, c, p, x, y, z);
  m.scale.set(w, h, d);
  return m;
}
export function cylinder(
  p: T.Object3D,
  r: number,
  h: number,
  c: number,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = mesh(cylinderGeo, c, p, x, y, z);
  m.scale.set(r, h, r);
  return m;
}
export function beam(
  p: T.Object3D,
  a: number[],
  b: number[],
  r: number,
  c: number,
) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    m = cylinder(p, r, start.distanceTo(end), c);
  m.position.copy(start.add(end).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    new T.Vector3(...b).sub(new T.Vector3(...a)).normalize(),
  );
  return m;
}
export function textPlane(
  p: T.Object3D,
  text: string,
  w: number,
  h: number,
  color = '#f0ecd8',
  bg?: string,
) {
  const cv = document.createElement('canvas');
  cv.width = 768;
  cv.height = 192;
  const ctx = cv.getContext('2d')!;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 192);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 70px "Segoe UI","Malgun Gothic",sans-serif';
  ctx.fillText(text, 384, 101, 720);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({
      map: tex,
      transparent: !bg,
      side: T.DoubleSide,
      depthWrite: !!bg,
    }),
  );
  p.add(m);
  return m;
}
export function groundText(
  p: T.Object3D,
  text: string,
  x: number,
  z: number,
  w = 13,
) {
  const m = textPlane(p, text, w, w / 4, '#eee5c5');
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.045, z);
  return m;
}
export function batchStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const bins = new Map<T.Material, T.BufferGeometry[]>(),
    others: T.Object3D[] = [];
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    if (o.material instanceof T.MeshStandardMaterial) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (g.index) {
        const n = g.toNonIndexed();
        g.dispose();
        bins.set(o.material, [...(bins.get(o.material) || []), n]);
      } else bins.set(o.material, [...(bins.get(o.material) || []), g]);
    } else others.push(o);
  });
  const result = new T.Group();
  for (const [material, geos] of bins) {
    const g = mergeGeometries(geos);
    if (g) {
      const m = new T.Mesh(g, material);
      m.castShadow = true;
      m.receiveShadow = true;
      result.add(m);
    }
    geos.forEach((g) => g.dispose());
  }
  for (const o of others) {
    o.updateWorldMatrix(true, false);
    const matrix = o.matrixWorld.clone();
    o.removeFromParent();
    o.matrix.copy(matrix);
    o.matrix.decompose(o.position, o.quaternion, o.scale);
    result.add(o);
  }
  return result;
}
export function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Merge rigid parts within each articulated group; preserve moving pivots.
const actorMaterial = new T.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  flatShading: true,
  roughness: 1,
});
export function batchParts(root: T.Object3D, preserve = new Set<T.Object3D>()) {
  for (const child of root.children)
    if (!(child instanceof T.Mesh)) batchParts(child, preserve);
  const source = root.children.filter(
    (o): o is T.Mesh<T.BufferGeometry, T.MeshStandardMaterial> =>
      o instanceof T.Mesh &&
      o.material instanceof T.MeshStandardMaterial &&
      !o.children.length &&
      !preserve.has(o),
  );
  if (!source.length) return;
  const geometries = source.map((o) => {
    o.updateMatrix();
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrix);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3)
      o.material.color.toArray(colors, i);
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    o.removeFromParent();
    return g;
  });
  const geometry = mergeGeometries(geometries)!;
  const combined = new T.Mesh(geometry, actorMaterial);
  combined.castShadow = combined.receiveShadow = true;
  root.add(combined);
  geometries.forEach((g) => g.dispose());
}
