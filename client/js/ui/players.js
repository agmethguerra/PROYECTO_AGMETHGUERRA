export class PlayersUI {
  constructor() {
    this.listEl = document.getElementById("players-list");
    this.countEl = document.getElementById("players-count");
    this.players = new Map();
  }

  updatePlayers(players, selfId) {
    this.players.clear();
    for (const player of players) {
      if (player.id !== selfId) {
        this.players.set(player.id, player);
      }
    }
    if (this.countEl) {
      this.countEl.textContent = this.players.size + (this.players.size === 1 ? " jugador" : " jugadores");
    }
    this.render();
  }

  addPlayer(player, selfId) {
    if (player.id === selfId) return;
    this.players.set(player.id, player);
    if (this.countEl) {
      this.countEl.textContent = this.players.size + (this.players.size === 1 ? " jugador" : " jugadores");
    }
    this.render();
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.countEl) {
      this.countEl.textContent = this.players.size + (this.players.size === 1 ? " jugador" : " jugadores");
    }
    this.render();
  }

  clear() {
    this.players.clear();
    if (this.countEl) {
      this.countEl.textContent = "0 jugadores";
    }
    if (this.listEl) {
      this.listEl.innerHTML = "";
    }
  }

  render() {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";
    
    for (const player of this.players.values()) {
      const item = document.createElement("div");
      item.className = "player-item";
      
      const dot = document.createElement("span");
      dot.className = "player-dot";
      
      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.name;
      
      item.appendChild(dot);
      item.appendChild(name);
      this.listEl.appendChild(item);
    }
  }
}
