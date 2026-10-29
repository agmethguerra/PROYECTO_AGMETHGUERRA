import { gridToScreen } from "../iso/math.js";
import { COLORS } from "../core/config.js";

export class DebugRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.enabled = false;
  }
  
  toggle() {
    this.enabled = !this.enabled;
  }
  
  render(zone, offsetX, offsetY, mouseCell) {
    if (!this.enabled || !zone) return;
    
    const ctx = this.ctx;
    const { width, height } = zone;
    
    ctx.save();
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 1;
    
    // Dibujar grid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = gridToScreen(x, y, offsetX, offsetY);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + 32, pos.y + 16);
        ctx.lineTo(pos.x, pos.y + 32);
        ctx.lineTo(pos.x - 32, pos.y + 16);
        ctx.closePath();
        ctx.stroke();
      }
    }
    
    // Dibujar celda bajo mouse
    if (mouseCell && mouseCell.x >= 0 && mouseCell.x < width && mouseCell.y >= 0 && mouseCell.y < height) {
      const pos = gridToScreen(mouseCell.x, mouseCell.y, offsetX, offsetY);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + 32, pos.y + 16);
      ctx.lineTo(pos.x, pos.y + 32);
      ctx.lineTo(pos.x - 32, pos.y + 16);
      ctx.closePath();
      ctx.stroke();
      
      // Coordenadas
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.fillText(`${mouseCell.x},${mouseCell.y}`, pos.x - 15, pos.y + 10);
    }
    
    ctx.restore();
  }
}
