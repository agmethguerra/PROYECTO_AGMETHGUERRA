import { EVENTS } from "../../../shared/config/events.js";
import { createMessage } from "../../../shared/protocol/messages.js";
import { validateChatMessage } from "../validate.js";

export function handleChatSend(worldManager, ws, socketId, payload, sendToSocket, broadcastToZone) {
  const playerId = worldManager.roomManager.getPlayerId(socketId);
  const player = worldManager.playerManager.getPlayer(playerId);
  
  if (!player) return;
  
  const { text } = payload;
  if (!validateChatMessage(text)) {
    sendToSocket(ws, createMessage(EVENTS.ERROR, { message: "Mensaje inválido" }));
    return;
  }
  
  const cleanText = text.trim();
  
  broadcastToZone(player.zoneId, createMessage(EVENTS.CHAT_MSG, {
    playerId: player.id,
    playerName: player.name,
    text: cleanText,
    zoneId: player.zoneId,
    timestamp: Date.now()
  }));
  
  console.log(`[Chat][${player.zoneId}] ${player.name}: ${cleanText}`);
}
