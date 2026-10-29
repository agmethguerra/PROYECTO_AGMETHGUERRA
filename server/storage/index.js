import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { isSupabaseEnabled } from "../services/supabase.js";
import { SupabaseStore } from "./SupabaseStore.js";
import { LocalFileStore } from "./LocalFileStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Elige Supabase (Postgres) si está activo; si no, el archivo local de desarrollo. */
export function createPlayerStore() {
  if (isSupabaseEnabled()) {
    return new SupabaseStore();
  }
  // .data/ está fuera de client/ y data/, así que nunca se sirve por HTTP
  return new LocalFileStore(join(__dirname, "../../.data/players.json"));
}
