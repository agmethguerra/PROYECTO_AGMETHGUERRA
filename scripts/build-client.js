// =============================================================================
// Build del cliente para Vercel (sin dependencias: solo Node).
// Genera dist/ con: el cliente, /shared, /data y un config.json con los datos
// PÚBLICOS que el navegador necesita (URL de Supabase, anon key y dirección del
// servidor WebSocket). Se ejecuta con:  npm run build:client
// =============================================================================
import { cpSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const env = (k) => (process.env[k] || "").trim();

const supabaseUrl = env("SUPABASE_URL").replace(/\/+$/, "");
const anonKey = env("SUPABASE_ANON_KEY");
let wsUrl = env("GAME_SERVER_URL").replace(/\/+$/, "");
const onVercel = !!process.env.VERCEL;

// Aceptamos https://... y lo convertimos a wss://... (WebSocket seguro)
wsUrl = wsUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");

// En Vercel un build mal configurado debe FALLAR, no desplegar una web rota
const problems = [];
if (onVercel && !wsUrl) problems.push("Falta GAME_SERVER_URL (dirección del servidor del juego, ej. https://infinitylife.onrender.com)");
if (onVercel && wsUrl && !wsUrl.startsWith("wss://")) problems.push("GAME_SERVER_URL debe ser https:// o wss:// (la web de Vercel es HTTPS y no puede abrir ws:// inseguro)");
if (supabaseUrl && !anonKey) problems.push("SUPABASE_URL está puesta pero falta SUPABASE_ANON_KEY");
if (onVercel && !supabaseUrl) problems.push("Falta SUPABASE_URL (sin ella en producción nadie podría iniciar sesión)");
if (problems.length) {
  console.error("\n[build] No se puede construir:\n - " + problems.join("\n - ") + "\n");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, "client"), dist, { recursive: true });
cpSync(join(root, "shared"), join(dist, "shared"), { recursive: true });
cpSync(join(root, "data"), join(dist, "data"), { recursive: true });

const config = {
  supabase: supabaseUrl ? { url: supabaseUrl, anonKey } : null,
  // El login "dev:" solo sirve contra un servidor sin Supabase; para probar el build en local
  devAuth: !supabaseUrl && env("DEV_AUTH") === "true",
  wsUrl: wsUrl || undefined
};
writeFileSync(join(dist, "config.json"), JSON.stringify(config, null, 2));

console.log(`[build] dist/ listo -> Supabase: ${config.supabase ? "sí" : "no"} | servidor: ${wsUrl || "(mismo origen)"}`);
