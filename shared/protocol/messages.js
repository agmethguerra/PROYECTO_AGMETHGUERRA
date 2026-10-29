/**
 * Protocolo base de mensajes
 * Formato: { type: string, payload: object, reqId?: string }
 */

export function createMessage(type, payload = {}, reqId = null) {
  const msg = { type, payload };
  if (reqId) msg.reqId = reqId;
  return msg;
}

export function isValidMessage(msg) {
  return msg && typeof msg.type === "string" && typeof msg.payload === "object";
}
