import { TileRenderer } from "./tiles.js";
import { EntityRenderer } from "./entities.js";
import { DebugRenderer } from "./debug.js";
import { ObjectRenderer } from "./objects.js";
import { CLIENT_CONFIG } from "../core/config.js";

export class Renderer {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gameState = gameState;
    this.tileRenderer = new TileRenderer(this.ctx);
    this.entityRenderer = new EntityRenderer(this.ctx);
    this.debugRenderer = new DebugRenderer(this.ctx);
    this.objectRenderer = new ObjectRenderer(this.ctx);
    this.destination = null; // celda a la que camina el jugador
    this.mouseCell = null;
    this.entityManager = null;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setMouseCell(cell) {
    this.mouseCell = cell;
  }

  toggleDebug() {
    this.debugRenderer.toggle();
  }

  /** Fondo negro con un halo gris muy tenue detrás de la torre. */
  drawBackground() {
    const { ctx, canvas } = this;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(
      canvas.width / 2, canvas.height * 0.35, 0,
      canvas.width / 2, canvas.height * 0.35, Math.max(canvas.width, canvas.height) * 0.7
    );
    glow.addColorStop(0, "rgba(255,255,255,0.045)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  render(camera) {
    const { ctx, canvas, gameState } = this;
    this.drawBackground();

    if (!gameState.zone) return;
    const offset = camera.getOffset();

    // Primero el pozo infinito; encima el suelo jugable y los avatares.
    this.tileRenderer.renderTower(gameState.zone, offset.x, offset.y, canvas.height);

    const hover = this.mouseCell && this.isInsideZone(this.mouseCell, gameState.zone) ? this.mouseCell : null;
    this.renderScene(gameState.zone, offset, hover, gameState.self?.id);
    this.tileRenderer.renderRim(gameState.zone, offset.x, offset.y);
    this.debugRenderer.render(gameState.zone, offset.x, offset.y, this.mouseCell);
  }

  /**
   * Dibuja suelo, objetos y avatares MEZCLADOS en orden de profundidad (x + y):
   * lo más lejano primero. Un avatar queda detrás de un pilar o de una plataforma
   * alta si está "más al fondo", y delante si está más cerca. Con la misma
   * profundidad, el suelo va antes que los objetos y estos antes que los avatares.
   */
  renderScene(zone, offset, hover, selfId) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 420);
    const items = [];

    for (let y = 0; y < zone.height; y++) {
      for (let x = 0; x < zone.width; x++) {
        items.push({ key: x + y, order: 0, x, y, draw: () =>
          this.tileRenderer.renderTile(zone, x, y, offset.x, offset.y, { hover, destination: this.destination, pulse }) });
      }
    }

    for (const o of zone.objects || []) {
      const level = zone.heightMap?.[o.y]?.[o.x] || 0;
      // Las alfombras son planas: van justo después del suelo, antes que avatares y otros objetos
      const flat = o.style === "flat";
      items.push({ key: flat ? o.x + o.y + 0.1 : o.x + o.w - 1 + (o.y + o.h - 1), order: flat ? 0.5 : 1, x: o.x, y: o.y,
        draw: () => this.objectRenderer.draw(o, level, offset.x, offset.y) });
    }

    const entities = this.entityManager ? this.entityManager.getEntities() : [];
    for (const e of entities) {
      const ex = e.displayX !== undefined ? e.displayX : e.x;
      const ey = e.displayY !== undefined ? e.displayY : e.y;
      if (ex === undefined || ey === undefined) continue;
      items.push({ key: ex + ey, order: 2, x: ex, y: ey, draw: () =>
        this.entityRenderer.renderOne({ ...e, x: ex, y: ey }, offset.x, offset.y, selfId, (e.displayH || 0) * CLIENT_CONFIG.HEIGHT_PX) });
    }

    items.sort((a, b) => a.key - b.key || a.order - b.order || a.x - b.x || a.y - b.y);
    for (const item of items) item.draw();
  }

  isInsideZone(cell, zone) {
    return cell.x >= 0 && cell.x < zone.width && cell.y >= 0 && cell.y < zone.height;
  }
}
