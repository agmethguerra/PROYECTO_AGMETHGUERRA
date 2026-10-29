import { GameServer } from "./core/server.js";

const server = new GameServer();
server.start().catch((error) => {
  console.error("[Server] No se pudo arrancar:", error);
  process.exit(1);
});
