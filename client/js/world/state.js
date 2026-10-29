export class GameState {
  constructor() {
    this.connected = false;
    this.self = null;
    this.players = new Map();
    this.zone = null;
    this.chatMessages = [];
  }

  setSelf(player) {
    this.self = player;
  }

  addPlayer(player) {
    this.players.set(player.id, player);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  updatePlayer(playerId, data) {
    const player = this.players.get(playerId);
    if (player) {
      Object.assign(player, data);
    }
  }

  clearPlayers() {
    this.players.clear();
  }

  setZone(zone) {
    this.zone = zone;
  }

  addChatMessage(msg) {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 50) {
      this.chatMessages.shift();
    }
  }
}
