import { gridToScreen } from "../iso/math.js";
import { boxFaces } from "../iso/pick.js";
import { CLIENT_CONFIG } from "../core/config.js";

export class TileRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /** Dibuja las caras verticales de la plataforma antes del suelo, para que se lea como torre. */
  renderTower(zone, offsetX, offsetY, viewportHeight) {
    if (!zone) return;

    const ctx = this.ctx;
    const { width, height } = zone;
    const corner = (x, y) => gridToScreen(x, y, offsetX, offsetY);
    const right = corner(width, 0);
    const front = corner(width, height);
    const left = corner(0, height);

    // La torre continúa más allá del encuadre; su base nunca se ve.
    const drop = Math.max(viewportHeight * 1.35, 760);
    const wallGradient = ctx.createLinearGradient(0, front.y, 0, front.y + drop);
    wallGradient.addColorStop(0, "#101010");
    wallGradient.addColorStop(0.16, "#090909");
    wallGradient.addColorStop(0.52, "#030303");
    wallGradient.addColorStop(1, "#000000");

    ctx.save();
    ctx.fillStyle = wallGradient;

    // Solo las dos caras que miran a la cámara
    ctx.beginPath();
    ctx.moveTo(right.x, right.y);
    ctx.lineTo(front.x, front.y);
    ctx.lineTo(front.x, front.y + drop);
    ctx.lineTo(right.x, right.y + drop);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(front.x, front.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(left.x, left.y + drop);
    ctx.lineTo(front.x, front.y + drop);
    ctx.closePath();
    ctx.fill();

    // Costuras verticales finas: sensación de pozo enorme y segmentado
    ctx.lineWidth = 1;
    for (let i = 1; i < width; i++) {
      const p = corner(width, i);
      const alpha = 0.10 + 0.08 * (i / width);
      ctx.strokeStyle = `rgba(210, 210, 210, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + drop);
      ctx.stroke();
    }
    for (let i = 1; i < height; i++) {
      const p = corner(i, height);
      const alpha = 0.10 + 0.08 * (i / height);
      ctx.strokeStyle = `rgba(210, 210, 210, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + drop);
      ctx.stroke();
    }

    // Bandas estructurales que se pierden en el abismo
    for (let y = 150; y < drop; y += 190) {
      const alpha = Math.max(0, 0.075 * (1 - y / drop));
      ctx.strokeStyle = `rgba(235, 235, 235, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(right.x, right.y + y);
      ctx.lineTo(front.x, front.y + y);
      ctx.lineTo(left.x, left.y + y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Borde superior brillante; se dibuja después del suelo para que quede limpio. */
  renderRim(zone, offsetX, offsetY) {
    if (!zone) return;
    const ctx = this.ctx;
    const { width, height } = zone;
    const corner = (x, y) => gridToScreen(x, y, offsetX, offsetY);
    const top = corner(0, 0);
    const right = corner(width, 0);
    const front = corner(width, height);
    const left = corner(0, height);

    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(front.x, front.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Dibuja UNA celda: sus paredes laterales (si está elevada) y su cara superior.
   * El renderer la llama en orden de profundidad, mezclada con objetos y avatares,
   * para que lo que está delante tape lo que está detrás.
   */
  renderTile(zone, x, y, offsetX, offsetY, { hover, destination, pulse }) {
    const HPX = CLIENT_CONFIG.HEIGHT_PX;
    const level = zone.heightMap?.[y]?.[x] || 0;
    const lift = level * HPX;
    const isBlocked = zone.collision[y] && zone.collision[y][x] === true;
    const isExit = zone.exits && zone.exits.some((e) => e.x === x && e.y === y);
    const isHover = !!hover && hover.x === x && hover.y === y;
    const isDest = !!destination && destination.x === x && destination.y === y;
    this.drawTile(x, y, offsetX, offsetY, { level, lift, isBlocked, isExit, isHover, isDest, alt: (x + y) % 2 === 0, pulse });
  }

  drawTile(x, y, offsetX, offsetY, { level, lift, isBlocked, isExit, isHover, isDest, alt, pulse }) {
    const ctx = this.ctx;
    const f = boxFaces(x, y, 1, 1, 0, lift, offsetX, offsetY);
    const path = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    };
    ctx.save();

    // Paredes laterales de las celdas elevadas: más claras cuanto más altas, para leer los niveles
    if (lift > 0) {
      const g = 10 + level * 12;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillStyle = `rgb(${Math.round(g * 0.6)},${Math.round(g * 0.6)},${Math.round(g * 0.6)})`;
      path(f.left); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgb(${Math.round(g * 0.85)},${Math.round(g * 0.85)},${Math.round(g * 0.85)})`;
      path(f.right); ctx.fill(); ctx.stroke();
    }

    // Cara superior
    if (isBlocked) {
      ctx.fillStyle = "#2a2a2a";
    } else {
      const g = (alt ? 13 : 9) + level * 14;
      ctx.fillStyle = `rgb(${g},${g},${g})`;
    }
    path(f.top);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isBlocked) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      path(f.top);
      ctx.stroke();
    }

    // Salida: casilla blanca que late suavemente
    if (isExit) {
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 14 + pulse * 8;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.62 + pulse * 0.33})`;
      path(f.top);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.stroke();
    }

    // Casilla bajo el cursor
    if (isHover && !isBlocked && !isExit) {
      ctx.fillStyle = "rgba(150, 150, 150, 0.42)";
      path(f.top);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.stroke();
    }

    // Destino al que camina el jugador: anillo blanco en el centro de la casilla
    if (isDest) {
      const cx = (f.top[0].x + f.top[2].x) / 2;
      const cy = (f.top[0].y + f.top[2].y) / 2;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 11, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
