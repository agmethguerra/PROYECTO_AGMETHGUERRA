export class RoomManager {
  constructor() {
    this.socketToPlayer = new Map(); // socketId -> playerId
  }

  addConnection(socketId, playerId) {
    this.socketToPlayer.set(socketId, playerId);
  }

  getPlayerId(socketId) {
    return this.socketToPlayer.get(socketId);
  }

  removeConnection(socketId) {
    this.socketToPlayer.delete(socketId);
  }
}
