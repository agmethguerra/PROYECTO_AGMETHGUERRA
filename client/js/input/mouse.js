export class MouseInput {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.enabled = true;
    
    canvas.addEventListener("click", (e) => {
      if (!this.enabled) return;
      this.handleClick(e);
    });
  }
  
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const cell = this.game.pickAt(screenX, screenY);
    this.game.sim?.closeMenu();

    // Objeto con acciones (nevera, cama...): abre el menú en vez de caminar
    if (cell.object?.actions?.length && this.game.sim?.ready) {
      this.game.sim.openObjectMenu(cell.object, e.clientX, e.clientY);
      return;
    }
    
    // Enviar solicitud de movimiento (el servidor calcula la ruta y decide si se puede)
    if (this.game.network && this.game.network.connected && this.game.gameState.zone) {
      this.game.setDestination(cell);
      this.game.network.moveRequest(cell.x, cell.y);
    }
  }
  
  enable() {
    this.enabled = true;
  }
  
  disable() {
    this.enabled = false;
  }
}
