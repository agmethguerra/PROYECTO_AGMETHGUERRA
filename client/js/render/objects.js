// =============================================================================
// Dibujo de objetos del mapa (pilares, cajas, mesas, alfombras...).
// Son placeholders geométricos en la misma estética monocroma; más adelante cada
// "type" se sustituirá por un sprite sin tocar el resto del código.
// =============================================================================
import { boxFaces } from "../iso/pick.js";
import { CLIENT_CONFIG } from "../core/config.js";

/** Multiplica un color #rrggbb por un factor (oscurecer < 1 < aclarar). */
function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

export class ObjectRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(o, baseLevel, ox, oy) {
    const HPX = CLIENT_CONFIG.HEIGHT_PX;
    const base = baseLevel * HPX;
    if (o.style === "flat") this.drawFlat(o, base, ox, oy);
    else this.drawBox(o, base, base + o.levels * HPX, ox, oy);
  }

  poly(pts) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  drawBox(o, base, top, ox, oy) {
    const ctx = this.ctx;
    const f = boxFaces(o.x, o.y, o.w, o.h, base, top, ox, oy);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";

    // Sombra en el suelo
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    this.poly(boxFaces(o.x, o.y, o.w, o.h, base, base, ox, oy).top);
    ctx.fill();

    ctx.fillStyle = shade(o.color, 0.55); this.poly(f.left); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(o.color, 0.8);  this.poly(f.right); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(o.color, 1.15); this.poly(f.top); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawFlat(o, base, ox, oy) {
    const ctx = this.ctx;
    const f = boxFaces(o.x, o.y, o.w, o.h, base, base, ox, oy);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    this.poly(f.top);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
