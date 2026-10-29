import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../.env") });

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 8080,
  HOST: process.env.HOST || "localhost",
  CLIENT_PORT: process.env.CLIENT_PORT || 3000,
  TICK_RATE: 30,
  MOVE_TICK_MS: 50,                                      // cada cuánto se revisa quién debe dar su siguiente paso
  // Fase 3 ---------------------------------------------------------------
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  AUTOSAVE_MS: Number(process.env.AUTOSAVE_MS) || 15000, // cada cuánto se guardan los cambios
  AUTH_TIMEOUT_MS: 30000,                                // tiempo máximo para identificarse tras conectar
  MAX_AUTH_ATTEMPTS: 5,                                  // intentos de login por conexión
  MAX_PAYLOAD_BYTES: 16 * 1024,                          // tamaño máximo de un mensaje WebSocket
  // Webs autorizadas a abrir WebSocket, separadas por comas. Ej: https://infinitylife.vercel.app
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
};
