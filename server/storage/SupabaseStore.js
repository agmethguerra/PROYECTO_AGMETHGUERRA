// Guarda el perfil de cada jugador en Postgres (tabla "players") vía la API REST de Supabase.
// Misma interfaz que LocalFileStore: load(uid) / save(uid, data) / flush().
import { restFetch } from "../services/supabase.js";

// El juego usa camelCase; Postgres snake_case. Aquí está la traducción.
function toRow(uid, d) {
  const row = { id: uid };
  if (d.name !== undefined) row.name = d.name;
  if (d.appearance !== undefined) row.appearance = d.appearance;
  if (d.zoneId !== undefined) row.zone_id = d.zoneId;
  if (d.x !== undefined) row.x = d.x;
  if (d.y !== undefined) row.y = d.y;
  if (d.dir !== undefined) row.dir = d.dir;
  if (d.schema !== undefined) row.schema = d.schema;
  if (d.onboarded !== undefined) row.onboarded = d.onboarded;
  if (d.jobId !== undefined) row.job_id = d.jobId;
  if (d.housingId !== undefined) row.housing_id = d.housingId;
  if (d.needs !== undefined) row.needs = d.needs;
  if (d.inventory !== undefined) row.inventory = d.inventory;
  // OJO: "balance" no se escribe nunca desde aquí; solo cambia con apply_ledger()
  if (d.createdAt !== undefined) row.created_at = new Date(d.createdAt).toISOString();
  if (d.updatedAt !== undefined) row.updated_at = new Date(d.updatedAt).toISOString();
  return row;
}

function fromRow(r) {
  return {
    schema: r.schema,
    name: r.name,
    appearance: r.appearance,
    zoneId: r.zone_id,
    x: r.x,
    y: r.y,
    dir: r.dir,
    onboarded: r.onboarded === true,
    jobId: r.job_id || null,
    housingId: r.housing_id || null,
    needs: r.needs || {},
    inventory: r.inventory || {},
    balance: r.balance || 0
  };
}

export class SupabaseStore {
  /** @returns {Promise<object|null>} perfil guardado o null si es cuenta nueva */
  async load(uid) {
    const res = await restFetch(`/rest/v1/players?id=eq.${encodeURIComponent(uid)}&select=*&limit=1`);
    if (!res.ok) throw new Error(`Supabase load HTTP ${res.status}`);
    const rows = await res.json();
    return rows.length ? fromRow(rows[0]) : null;
  }

  /**
   * Upsert: crea la fila si no existe y, si existe, actualiza SOLO las columnas enviadas
   * (merge-duplicates), así las fases siguientes pueden añadir columnas sin pisarse.
   */
  async save(uid, data) {
    const res = await restFetch("/rest/v1/players?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(toRow(uid, data))
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Supabase save HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
  }

  /**
   * Movimiento de dinero atómico en Postgres (función apply_ledger).
   * @returns {{ok:boolean, balance:number, duplicate:boolean}}
   */
  async applyLedger(uid, delta, reason, { ref = null, key = null } = {}) {
    const body = JSON.stringify({ p_player: uid, p_delta: delta, p_reason: reason, p_ref: ref, p_key: key });
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await restFetch("/rest/v1/rpc/apply_ledger", { method: "POST", body });
      if (res.ok) {
        const rows = await res.json();
        const r = Array.isArray(rows) ? rows[0] : rows;
        return { ok: r.out_ok, balance: r.out_balance, duplicate: r.out_duplicate };
      }
      const detail = await res.text().catch(() => "");
      // Dos peticiones con la misma clave a la vez: la segunda falla y al reintentar ve el resultado de la primera
      if (key && attempt === 0 && /duplicate key|23505/.test(detail)) continue;
      throw new Error(`Supabase ledger HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
  }

  async flush() {} // cada guardado se envía al instante; nada pendiente
}
