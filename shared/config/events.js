// Nombres de eventos cliente <-> servidor

export const EVENTS = {
  // Autenticación / conexión
  AUTH_ANON: "auth:anon",       // cliente -> servidor: entrar como invitado (no guarda progreso)
  AUTH_LOGIN: "auth:login",     // cliente -> servidor: entrar con cuenta { idToken, name? }
  AUTH_OK: "auth:ok",           // servidor -> cliente: login correcto { name, guest }
  AUTH_ERROR: "auth:error",     // servidor -> cliente: login rechazado { message }
  SESSION_REPLACED: "session:replaced", // servidor -> cliente: tu cuenta entró desde otro sitio
  WELCOME: "welcome",
  
  // Mundo
  WORLD_SNAPSHOT: "world:snapshot",
  ZONE_CHANGE: "zone:change",
  
  // Jugadores
  PLAYER_JOINED: "player:joined",
  PLAYER_LEFT: "player:left",
  PLAYER_MOVE_REQUEST: "player:move_request",
  PLAYER_MOVE_ACCEPT: "player:move_accept",
  PLAYER_MOVE_REJECT: "player:move_reject",
  PLAYER_MOVED: "player:moved",
  
  // Apariencia
  APPEARANCE_SET: "appearance:set",
  APPEARANCE_UPDATE: "appearance:update",
  
  // Chat
  CHAT_SEND: "chat:send",
  CHAT_MSG: "chat:msg",
  
  // Fase 5: simulación de vida
  ONBOARDING_REQUIRED: "onboarding:required", // servidor -> cliente: cuenta nueva, hay que elegir avatar/empleo/vivienda
  ONBOARDING_COMPLETE: "onboarding:complete", // cliente -> servidor: { appearance, jobId, housingId }
  ONBOARDING_ERROR: "onboarding:error",       // servidor -> cliente: { message }
  SIM_STATE: "sim:state",                     // servidor -> cliente: estado completo (necesidades, saldo, reloj...)
  NEEDS_UPDATE: "needs:update",               // servidor -> cliente: { health, needs }
  ECON_BALANCE: "econ:balance",               // servidor -> cliente: { balance, delta, reason }
  INVENTORY_UPDATE: "inventory:update",       // servidor -> cliente: { inventory }
  OBJECT_INTERACT: "object:interact",         // cliente -> servidor: { objectId, action }
  ACTIVITY_START: "activity:start",           // servidor -> cliente: { action, label, durationMs }
  ACTIVITY_END: "activity:end",               // servidor -> cliente: { action, completed, reason? }
  ACTIVITY_CANCEL: "activity:cancel",         // cliente -> servidor
  PLAYER_STATUS: "player:status",             // servidor -> zona: { id, text|null }  ("Durmiendo")
  
  // Errores
  ERROR: "error"
};
