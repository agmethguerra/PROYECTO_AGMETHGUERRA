export function validateMessage(msg) {
  if (!msg || typeof msg !== "object") return false;
  if (typeof msg.type !== "string") return false;
  if (typeof msg.payload !== "object") return false;
  return true;
}

export function validateChatMessage(text) {
  if (typeof text !== "string") return false;
  if (text.trim().length === 0) return false;
  if (text.length > 100) return false;
  return true;
}
