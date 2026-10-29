// =============================================================================
// Selección de celda con alturas: ¿qué celda hay bajo el ratón?
// Con suelos elevados y objetos altos, la conversión inversa simple (pantalla -> cuadrícula)
// se equivoca, porque lo que ves "encima" tapa celdas que están detrás. Aquí se prueban
// las celdas de delante hacia atrás con la forma real con la que se dibujan.
// =============================================================================
import { gridToScreen, screenToGridCell } from "./math.js";
import { CLIENT_CONFIG } from "../core/config.js";

/** ¿El punto está dentro de un polígono convexo (lista de {x,y})? */
export function pointInConvex(px, py, pts) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/**
 * Las 3 caras visibles de un prisma que ocupa (x..x+w, y..y+h) y va de baseLift a topLift
 * (en píxeles hacia arriba). Sirve igual para una celda elevada que para un objeto.
 */
export function boxFaces(x, y, w, h, baseLift, topLift, ox, oy) {
  const T = gridToScreen(x, y, ox, oy);
  const R = gridToScreen(x + w, y, ox, oy);
  const B = gridToScreen(x + w, y + h, ox, oy);
  const L = gridToScreen(x, y + h, ox, oy);
  const up = (p, lift) => ({ x: p.x, y: p.y - lift });
  return {
    top: [up(T, topLift), up(R, topLift), up(B, topLift), up(L, topLift)],
    left: [up(L, topLift), up(B, topLift), up(B, baseLift), up(L, baseLift)],
    right: [up(B, topLift), up(R, topLift), up(R, baseLift), up(B, baseLift)]
  };
}

/** Devuelve {x, y} de la celda bajo (screenX, screenY). */
export function pickCell(screenX, screenY, zone, ox, oy) {
  if (!zone) return screenToGridCell(screenX, screenY, ox, oy);
  const HPX = CLIENT_CONFIG.HEIGHT_PX;
  const hm = zone.heightMap || [];

  // Candidatos ordenados de delante (x+y mayor) hacia atrás
  const candidates = [];
  for (let y = 0; y < zone.height; y++) {
    for (let x = 0; x < zone.width; x++) {
      candidates.push({ kind: "tile", x, y, key: x + y });
    }
  }
  for (const o of zone.objects || []) {
    if (o.style === "flat") continue; // las alfombras no estorban: se pisa la celda de debajo
    candidates.push({ kind: "object", o, key: o.x + o.w - 1 + (o.y + o.h - 1) + 0.5 });
  }
  candidates.sort((a, b) => b.key - a.key);

  for (const c of candidates) {
    if (c.kind === "tile") {
      const lift = (hm[c.y]?.[c.x] || 0) * HPX;
      const f = boxFaces(c.x, c.y, 1, 1, 0, lift, ox, oy);
      if (pointInConvex(screenX, screenY, f.top) ||
          (lift > 0 && (pointInConvex(screenX, screenY, f.left) || pointInConvex(screenX, screenY, f.right)))) {
        return { x: c.x, y: c.y };
      }
    } else {
      const o = c.o;
      const base = (hm[o.y]?.[o.x] || 0) * HPX;
      const f = boxFaces(o.x, o.y, o.w, o.h, base, base + o.levels * HPX, ox, oy);
      if (pointInConvex(screenX, screenY, f.top) || pointInConvex(screenX, screenY, f.left) || pointInConvex(screenX, screenY, f.right)) {
        // Clic en un objeto: la celda de su esquina frontal (el servidor dirá si se puede)
        return { x: o.x + o.w - 1, y: o.y + o.h - 1, object: o };
      }
    }
  }
  return screenToGridCell(screenX, screenY, ox, oy); // fuera del mapa
}
