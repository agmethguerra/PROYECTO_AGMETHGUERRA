export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.speed = 0.1;
  }

  follow(targetX, targetY) {
    // targetX, targetY en coordenadas de pantalla
    this.targetX = targetX - this.canvas.width / 2;
    this.targetY = targetY - this.canvas.height / 2;
  }

  update() {
    this.x += (this.targetX - this.x) * this.speed;
    this.y += (this.targetY - this.y) * this.speed;
  }

  getOffset() {
    return { x: -this.x, y: -this.y };
  }
}
