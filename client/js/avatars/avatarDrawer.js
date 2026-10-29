import { avatarData } from "./avatarData.js";

export class AvatarDrawer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  drawAvatar(screenX, screenY, appearance, direction = "down", isMoving = false) {
    if (!appearance) return;
    
    const ctx = this.ctx;
    ctx.save();
    
    const gender = appearance.gender || "male";
    const parts = appearance.parts || {};
    
    const baseY = screenY + 18;
    
    // Sombra
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(screenX, baseY + 2, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 1. BODY
    this.drawBody(screenX, baseY, gender, parts.body);
    
    // 2. BOTTOM
    this.drawBottom(screenX, baseY, gender, parts.bottom);
    
    // 3. SHOES
    this.drawShoes(screenX, baseY, gender, parts.shoes);
    
    // 4. TOP
    this.drawTop(screenX, baseY, gender, parts.top);
    
    // 5. HAIR
    this.drawHair(screenX, baseY, gender, parts.hair);
    
    ctx.restore();
  }

  drawBody(x, y, gender, bodyId) {
    const ctx = this.ctx;
    const part = bodyId ? avatarData.getPart(bodyId) : null;
    const skinColor = part?.colors?.skin || (gender === "female" ? "#e7b98b" : "#d7a77c");
    
    ctx.fillStyle = skinColor;
    // Torso isométrico simplificado
    ctx.beginPath();
    ctx.ellipse(x, y - 6, gender === "female" ? 6 : 7, gender === "female" ? 8 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawBottom(x, y, gender, bottomId) {
    const ctx = this.ctx;
    const part = bottomId ? avatarData.getPart(bottomId) : null;
    const clothColor = part?.colors?.cloth || "#2c3e50";
    
    ctx.fillStyle = clothColor;
    if (gender === "female" && bottomId && bottomId.includes("f01")) {
      // Falda
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + 8, y + 6);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 8, y + 6);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pantalones
      ctx.beginPath();
      ctx.ellipse(x - 3, y + 6, 4, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 6, 4, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawShoes(x, y, gender, shoesId) {
    const ctx = this.ctx;
    const part = shoesId ? avatarData.getPart(shoesId) : null;
    const shoeColor = part?.colors?.shoe || "#ecf0f1";
    const soleColor = part?.colors?.sole || "#2c3e50";
    
    // Zapato izquierdo
    ctx.fillStyle = soleColor;
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 10, 3, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 9, 3, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Zapato derecho
    ctx.fillStyle = soleColor;
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 10, 3, 2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 9, 3, 2, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTop(x, y, gender, topId) {
    const ctx = this.ctx;
    const part = topId ? avatarData.getPart(topId) : null;
    const clothColor = part?.colors?.cloth || "#4ecdc4";
    
    ctx.fillStyle = clothColor;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, gender === "female" ? 7 : 8, gender === "female" ? 7 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawHair(x, y, gender, hairId) {
    const ctx = this.ctx;
    const part = hairId ? avatarData.getPart(hairId) : null;
    const hairColor = part?.colors?.hair || "#3b2f2f";
    
    ctx.fillStyle = hairColor;
    
    if (gender === "female") {
      if (hairId === "hair_female_02") {
        // Media melena
        ctx.beginPath();
        ctx.ellipse(x, y - 12, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - 5, y - 8, 4, 6, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 5, y - 8, 4, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Coleta corta
        ctx.beginPath();
        ctx.ellipse(x, y - 12, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 10, 3, 4, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      if (hairId === "hair_male_02") {
        // Despeinado
        ctx.beginPath();
        ctx.ellipse(x, y - 13, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 2, y - 11, 3, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Corto clásico
        ctx.beginPath();
        ctx.ellipse(x, y - 13, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
