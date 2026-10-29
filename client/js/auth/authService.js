// =============================================================================
// authService: todo lo relacionado con "quién eres" en el cliente.
// - Con Supabase configurado => correo/contraseña y Google reales (Supabase Auth).
// - Sin Supabase (desarrollo) => solo escribes un nombre.
// El SDK de Supabase se descarga del CDN solo cuando hace falta.
// =============================================================================
const SUPABASE_SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const DEV_NAME_KEY = "infinitylife.devName";

// Traduce los mensajes de error de Supabase a mensajes para el jugador
const ERROR_PATTERNS = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Confirma tu correo antes de entrar (revisa tu bandeja)."],
  [/already registered|already been registered/i, "Ese correo ya tiene una cuenta. Inicia sesión."],
  [/password should be at least|weak password/i, "La contraseña es muy corta (mínimo 6 caracteres)."],
  [/valid email|invalid email|unable to validate email/i, "El correo no es válido."],
  [/rate limit|too many/i, "Demasiados intentos. Espera un momento."],
  [/failed to fetch|network/i, "Sin conexión. Revisa tu internet."]
];

export function friendlyError(error) {
  const msg = error?.message || "";
  for (const [re, text] of ERROR_PATTERNS) if (re.test(msg)) return text;
  return msg || "Ocurrió un error inesperado.";
}

class AuthService {
  constructor() {
    this.config = null;   // { supabase: {url, anonKey}|null, devAuth: bool, wsUrl?: string }
    this.sb = null;       // cliente de Supabase cuando está activo
    this.devName = null;  // nombre en modo desarrollo
  }

  get mode() {
    if (this.config?.supabase) return "supabase";
    if (this.config?.devAuth) return "dev";
    return "none";
  }

  /**
   * Carga la configuración y, si ya había una sesión abierta de antes,
   * la devuelve para entrar sin volver a pedir datos.
   * @returns {Promise<{kind:"supabase"|"dev"}|null>}
   */
  async init() {
    // config.json lo genera el build de Vercel; el servidor Node también lo sirve en local
    const res = await fetch("/config.json", { cache: "no-store" });
    this.config = await res.json();

    if (this.config.supabase) {
      const { createClient } = await import(SUPABASE_SDK);
      this.sb = createClient(this.config.supabase.url, this.config.supabase.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      // getSession espera a que Supabase termine de leer la sesión guardada
      // (o la que llega en la URL al volver de Google)
      const { data } = await this.sb.auth.getSession();
      return data.session ? { kind: "supabase" } : null;
    }

    if (this.config.devAuth) {
      try { this.devName = localStorage.getItem(DEV_NAME_KEY); } catch (e) { /* sin storage */ }
      return this.devName ? { kind: "dev" } : null;
    }
    return null;
  }

  // ---- Supabase --------------------------------------------------------------
  async signInEmail(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  /**
   * Crea la cuenta. Si el proyecto exige confirmar el correo, Supabase no devuelve
   * sesión todavía: en ese caso devolvemos { needsConfirm: true } y no se entra al juego.
   */
  async registerEmail(email, password, name) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;
    return { needsConfirm: !data.session };
  }

  async signInGoogle() {
    // Redirige a Google y vuelve a esta misma página con la sesión en la URL
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
  }

  // ---- Modo desarrollo ---------------------------------------------------------
  signInDev(name) {
    this.devName = name;
    try { localStorage.setItem(DEV_NAME_KEY, name); } catch (e) { /* sin storage */ }
  }

  // ---- Común ---------------------------------------------------------------------
  /** Token que se envía al servidor para que verifique quién eres (Supabase lo renueva si caducó). */
  async getIdToken() {
    if (this.mode === "supabase") {
      const { data } = await this.sb.auth.getSession();
      if (!data.session) throw new Error("Sin sesión");
      return data.session.access_token;
    }
    return `dev:${this.devName}`;
  }

  async signOut() {
    if (this.mode === "supabase" && this.sb) await this.sb.auth.signOut();
    this.devName = null;
    try { localStorage.removeItem(DEV_NAME_KEY); } catch (e) { /* sin storage */ }
  }
}

export const authService = new AuthService();
