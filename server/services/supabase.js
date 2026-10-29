// =============================================================================
// Servicio Supabase (lado servidor)
// -----------------------------------------------------------------------------
// - Con SUPABASE_URL + claves  => login real (Supabase Auth) y progreso en Postgres.
// - Sin ellas                  => "modo desarrollo": token falso "dev:<nombre>" y
//                                 progreso en un archivo local. Útil para programar.
//
// No usa el SDK de Supabase: habla con su API REST con fetch (Node 20+), así el
// servidor no necesita dependencias extra y es fácil de probar.
// =============================================================================
import { SERVER_CONFIG } from "../core/config.js";

const TIMEOUT_MS = 8000;

let enabled = false;
let baseUrl = "";
let anonKey = "";
let serviceKey = "";

/** Quita espacios y barras finales de la URL. */
function cleanUrl(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

/**
 * Inicializa Supabase si hay SUPABASE_URL. Si está configurado pero algo falla
 * (faltan claves, tabla sin crear, clave errónea) lanza el error: mejor no arrancar
 * que arrancar "abierto" o perdiendo progreso sin avisar.
 */
export async function initSupabase() {
  baseUrl = cleanUrl(process.env.SUPABASE_URL);
  if (!baseUrl) {
    console.log("[Supabase] Sin SUPABASE_URL -> MODO DESARROLLO (login simulado + guardado local)");
    return false;
  }
  anonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
  serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!anonKey || !serviceKey) {
    throw new Error("Faltan SUPABASE_ANON_KEY y/o SUPABASE_SERVICE_ROLE_KEY en el entorno");
  }

  // Comprobación de arranque: ¿la clave sirve y existe la tabla players?
  const res = await restFetch("/rest/v1/players?select=id&limit=1");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `No se pudo leer la tabla "players" (HTTP ${res.status}). ¿Ejecutaste supabase/schema.sql y es correcta la service_role key? ${detail.slice(0, 200)}`
    );
  }
  enabled = true;
  console.log(`[Supabase] Conectado a ${baseUrl} (Auth + Postgres)`);
  return true;
}

export function isSupabaseEnabled() {
  return enabled;
}

/** El login "dev:" solo existe sin Supabase y fuera de producción. */
export function isDevAuthAllowed() {
  return !enabled && !SERVER_CONFIG.IS_PRODUCTION;
}

/**
 * Llamada a la API REST (PostgREST) con la clave de servicio. Esa clave se salta las
 * reglas RLS: solo vive en el servidor y NUNCA se envía al navegador.
 */
export function restFetch(path, options = {}) {
  return fetch(baseUrl + path, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

/**
 * Configuración PÚBLICA para el cliente (URL y anon key son públicas por diseño).
 * `wsUrl` solo se rellena en el build de Vercel; aquí el cliente usa su propio origen.
 */
export function getPublicClientConfig() {
  return {
    supabase: enabled ? { url: baseUrl, anonKey } : null,
    devAuth: isDevAuthAllowed()
  };
}

/**
 * Comprueba un token de sesión y devuelve { uid, displayName, email }.
 * Lanza un Error si el token no es válido o caducó.
 */
export async function verifyIdentity(idToken) {
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 4096) {
    throw new Error("Token inválido");
  }

  // --- Modo Supabase real: Supabase Auth valida la firma, la caducidad y que el usuario exista ---
  if (enabled) {
    const res = await fetch(`${baseUrl}/auth/v1/user`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: anonKey, Authorization: `Bearer ${idToken}` }
    });
    if (!res.ok) throw new Error(`Supabase rechazó el token (HTTP ${res.status})`);
    const user = await res.json();
    if (!user?.id) throw new Error("Respuesta de Supabase sin usuario");
    const meta = user.user_metadata || {};
    return {
      uid: user.id,
      displayName: meta.name || meta.full_name || (user.email ? user.email.split("@")[0] : ""),
      email: user.email || null
    };
  }

  // --- Modo desarrollo: token falso "dev:<nombre>" ---
  if (isDevAuthAllowed() && idToken.startsWith("dev:")) {
    const name = idToken.slice(4).trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!slug) throw new Error("Nombre de desarrollo inválido");
    return { uid: `dev_${slug}`, displayName: name, email: null };
  }

  throw new Error("Autenticación no disponible");
}
