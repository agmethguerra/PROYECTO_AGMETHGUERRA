import { EVENTS } from "../../../shared/config/events.js";
import { createMessage } from "../../../shared/protocol/messages.js";

export function handleAppearanceSet(worldManager, ws, socketId, payload, sendToSocket, broadcastToZone) {
  const playerId = worldManager.roomManager.getPlayerId(socketId);
  const player = worldManager.playerManager.getPlayer(playerId);
  
  if (!player) return;
  
  const { appearance } = payload;
  if (!appearance) {
    sendToSocket(ws, createMessage(EVENTS.ERROR, { message: "Apariencia inválida" }));
    return;
  }
  
  // Validar y aplicar apariencia
  const validated = worldManager.appearanceManager.validateAppearance(appearance);
  player.appearance = validated;
  
  // Notificar al jugador
  sendToSocket(ws, createMessage(EVENTS.APPEARANCE_UPDATE, {
    appearance: player.appearance
  }));
  
  // Sincronizar con otros jugadores de la zona
  broadcastToZone(player.zoneId, createMessage(EVENTS.APPEARANCE_UPDATE, {
    playerId: player.id,
    appearance: player.appearance
  }), player.id);
  
  console.log(`[Appearance] ${player.name} updated appearance (${player.appearance.gender})`);
}
