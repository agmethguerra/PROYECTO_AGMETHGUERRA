import { spriteLoader } from "./spriteLoader.js";

export class SpriteDrawer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Dibuja un cuadro del avatar con los pies apoyados en (feetX, feetY).
   * frame: 0 = reposo, 1 = paso alterno.
   */
  drawFrame(characterId, direction, frame, feetX, feetY, scale) {
    const cfg = spriteLoader.config;
    const image = spriteLoader.getImage(characterId);
    if (!cfg || !image) return false;

    const s = scale ?? cfg.drawScale;
    let dirIndex = cfg.directions.indexOf(direction);
    if (dirIndex === -1) dirIndex = 0;

    const cw = cfg.cellWidth;
    const ch = cfg.cellHeight;
    const ctx = this.ctx;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // El atlas deja los pies a 4px del borde inferior de la celda.
    ctx.drawImage(
      image,
      dirIndex * cw, frame * ch, cw, ch,
      feetX - (cw * s) / 2,
      feetY - (ch - 4) * s,
      cw * s,
      ch * s
    );
    ctx.restore();
    return true;
  }

  /** Dibuja un avatar del mundo, con animación de caminar si se está moviendo. */
  drawSprite(feetX, feetY, characterId, direction = "down", isMoving = false) {
    const cfg = spriteLoader.config;
    if (!cfg || !spriteLoader.getImage(characterId)) return false;

    let frame = cfg.idleFrame;
    let bob = 0;
    if (isMoving) {
      const t = Date.now();
      frame = cfg.walkFrames[Math.floor(t / cfg.walkFrameMs) % cfg.walkFrames.length];
      bob = -Math.abs(Math.sin(t / 95)) * 1.6;
    }

    return this.drawFrame(characterId, direction, frame, feetX, feetY + bob);
  }
}
