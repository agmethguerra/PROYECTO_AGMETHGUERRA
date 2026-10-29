export class KeyboardInput {
  constructor(game) {
    this.game = game;
    this.keys = {};
    this.moveDelay = 150; // ms entre movimientos con teclado
    this.lastMoveTime = 0;
    this.enabled = true;
    
    document.addEventListener("keydown", (e) => {
      if (!this.enabled || this.isTyping()) return;
      // Evitar scroll con flechas/espacio
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      this.keys[e.key.toLowerCase()] = true;
    });
    
    document.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = true;
      delete this.keys[e.key.toLowerCase()];
    });
  }
  
  isTyping() {
    return ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  }

  update() {
    if (!this.enabled || this.isTyping()) return;
    if (!this.game.network || !this.game.network.connected) return;
    if (!this.game.gameState.self) return;
    
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveDelay) return;
    
    let dx = 0;
    let dy = 0;
    
    // WASD
    if (this.keys["w"] || this.keys["arrowup"]) dy = -1;
    if (this.keys["s"] || this.keys["arrowdown"]) dy = 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dx = -1;
    if (this.keys["d"] || this.keys["arrowright"]) dx = 1;
    
    if (dx === 0 && dy === 0) return;
    
    const self = this.game.gameState.self;
    const targetX = Math.floor(self.x) + dx;
    const targetY = Math.floor(self.y) + dy;
    
    this.game.network.moveRequest(targetX, targetY);
    this.lastMoveTime = now;
  }
  
  enable() {
    this.enabled = true;
  }
  
  disable() {
    this.enabled = false;
  }
}
