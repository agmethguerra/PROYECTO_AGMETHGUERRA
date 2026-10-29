import { nanoid } from "nanoid";
import { generateGuestName, getRandomColor } from "../core/utils.js";

export class PlayerManager {
  constructor() {
    this.players = new Map(); // playerId -> player
  }

  createPlayer(socketId, zoneId = "hub") {
    const playerId = nanoid();
    const player = {
      id: playerId,
      socketId,
      name: generateGuestName(),
      appearance: {
        color: getRandomColor()
      },
      zoneId,
      x: 0,
      y: 0,
      dir: "down",
      lastMoveAt: Date.now()
    };
    this.players.set(playerId, player);
    return player;
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return null;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  removePlayerBySocketId(socketId) {
    const player = this.getPlayerBySocketId(socketId);
    if (player) {
      this.removePlayer(player.id);
      return player;
    }
    return null;
  }

  getPlayersInZone(zoneId) {
    const result = [];
    for (const player of this.players.values()) {
      if (player.zoneId === zoneId) {
        result.push(player);
      }
    }
    return result;
  }
}
