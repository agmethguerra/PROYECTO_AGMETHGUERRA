import { gridToScreen } from "../iso/math.js";
import { AvatarDrawer } from "../avatars/avatarDrawer.js";
import { SpriteDrawer } from "../avatars/spriteDrawer.js";
import { spriteLoader } from "../avatars/spriteLoader.js";

const SPRITE_HEIGHT = 108; // alto aproximado del avatar en pantalla (px)

export class EntityRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.avatarDrawer = new AvatarDrawer(ctx);
    this.spriteDrawer = new SpriteDrawer(ctx);
  }

  renderEntities(entities, offsetX, offsetY, selfId) {
    for (const entity of entities) this.renderOne(entity, offsetX, offsetY, selfId, 0);
  }

  /** Dibuja un avatar; `lift` son los píxeles que sube por estar sobre una celda elevada. */
  renderOne(entity, offsetX, offsetY, selfId, lift = 0) {
    const x = entity.displayX !== undefined ? entity.displayX : entity.x;
    const y = entity.displayY !== undefined ? entity.displayY : entity.y;
    if (x === undefined || y === undefined) return;
    const pos = gridToScreen(x, y, offsetX, offsetY);
    this.drawEntity(pos.x, pos.y - lift, entity, entity.id === selfId);
  }

  drawEntity(screenX, screenY, entity, isSelf) {
    const ctx = this.ctx;
    // (screenX, screenY) es el vértice superior de la casilla; los pies van al centro.
    const feetY = screenY + 16;

    ctx.save();

    // Sombra suave bajo los pies
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(screenX, feetY, 14, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Anillo blanco para el jugador propio
    if (isSelf) {
      ctx.beginPath();
      ctx.ellipse(screenX, feetY, 19, 9.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Avatar en pixel art (único elemento con color)
    let drawn = false;
    if (spriteLoader.loaded && entity.appearance) {
      const charId = spriteLoader.resolveCharacterId(entity.appearance);
      drawn = this.spriteDrawer.drawSprite(screenX, feetY, charId, entity.dir || "down", entity.isMoving);
    }
    if (!drawn && entity.appearance) {
      this.avatarDrawer.drawAvatar(screenX, screenY, entity.appearance, entity.dir || "down", entity.isMoving);
    }

    const tagY = feetY - SPRITE_HEIGHT - 6;
    this.drawNameTag(screenX, tagY, entity.name || "Player", isSelf);

    if (entity.status) this.drawStatus(screenX, tagY - 15, entity.status);

    if (entity.bubble && Date.now() < entity.bubble.until) {
      const left = entity.bubble.until - Date.now();
      const alpha = Math.min(1, left / 500);
      this.drawChatBubble(screenX, tagY - (entity.status ? 32 : 14), entity.bubble.text, alpha);
    }

    ctx.restore();
  }

  /** Estado de lo que hace el personaje ("Durmiendo", "Comiendo"...). */
  drawStatus(x, y, text) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "italic 500 11px 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = "rgba(20, 20, 20, 0.85)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 8, w, 16, 8); else ctx.rect(x - w / 2, y - 8, w, 16);
    ctx.fill();
    ctx.fillStyle = "#cfd4dc";
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  drawNameTag(x, y, text, isSelf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = (isSelf ? "600 " : "500 ") + "11px 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const padX = 7;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 16;
    const left = x - w / 2;
    const top = y - h / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(left, top, w, h, 4);
    } else {
      ctx.rect(left, top, w, h);
    }
    ctx.fill();
    ctx.strokeStyle = isSelf ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  /** Globo de chat blanco con texto negro, con salto de línea automático. */
  drawChatBubble(x, bottomY, text, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "500 12px 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxWidth = 170;
    const lines = [];
    let line = "";
    for (const word of String(text).split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 4);

    const lineH = 15;
    const padX = 10;
    const padY = 7;
    const w = Math.min(maxWidth, Math.max(...shown.map((l) => ctx.measureText(l).width))) + padX * 2;
    const h = shown.length * lineH + padY * 2;
    const left = x - w / 2;
    const top = bottomY - h - 6;

    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(left, top, w, h, 8);
    else ctx.rect(left, top, w, h);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Colita del globo
    ctx.beginPath();
    ctx.moveTo(x - 6, top + h - 0.5);
    ctx.lineTo(x + 6, top + h - 0.5);
    ctx.lineTo(x, top + h + 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#000000";
    shown.forEach((l, i) => ctx.fillText(l, x, top + padY + lineH * i + lineH / 2));
    ctx.restore();
  }
}
