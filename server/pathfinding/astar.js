// =============================================================================
// A* sobre la cuadrícula del servidor (4 direcciones, con alturas).
// Es una función pura: recibe un "grid" con reglas y devuelve la ruta. Así se
// puede probar sin servidor y reutilizar para NPCs (Fase 5).
//
//   grid = {
//     width, height,
//     canEnter(x, y)              -> la celda existe y no está bloqueada
//     canStep(fx, fy, tx, ty)     -> se puede pasar de una celda a la contigua (altura, etc.)
//     isExit(x, y)                -> es una salida de zona
//   }
// Devuelve [{x,y}, ...] SIN incluir el punto de partida, o null si no hay ruta.
// =============================================================================

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Cola de prioridad mínima (montículo binario). */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * @param opts.maxNodes   tope de celdas exploradas (protege al servidor de peticiones abusivas)
 * @param opts.maxLength  tope de longitud de la ruta devuelta
 */
export function findPath(grid, start, goal, { maxNodes = 5000, maxLength = 80 } = {}) {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!grid.canEnter(goal.x, goal.y)) return null;

  const W = grid.width;
  const key = (x, y) => y * W + x;
  const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  const open = new MinHeap();
  const best = new Map();   // key -> mejor coste g conocido
  const parent = new Map(); // key -> key del anterior
  const startKey = key(start.x, start.y);
  best.set(startKey, 0);
  open.push({ x: start.x, y: start.y, g: 0, f: h(start.x, start.y) });

  let expanded = 0;
  const closed = new Set();

  while (open.size) {
    const cur = open.pop();
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let k = ck;
      while (k !== startKey) {
        path.push({ x: k % W, y: Math.floor(k / W) });
        k = parent.get(k);
      }
      path.reverse();
      return path.length > maxLength ? null : path;
    }

    if (++expanded > maxNodes) return null;

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!grid.canEnter(nx, ny)) continue;
      // Una salida solo se pisa como destino final, nunca "de paso"
      if (grid.isExit(nx, ny) && !(nx === goal.x && ny === goal.y)) continue;
      if (!grid.canStep(cur.x, cur.y, nx, ny)) continue;

      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const g = cur.g + 1;
      if (g >= (best.get(nk) ?? Infinity)) continue;
      best.set(nk, g);
      parent.set(nk, ck);
      open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
    }
  }
  return null;
}
