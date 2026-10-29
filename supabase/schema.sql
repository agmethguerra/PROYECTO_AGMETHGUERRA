-- =============================================================================
-- Infinitylife - esquema de Supabase (Fases 3 a 5)
-- Pégalo en Supabase > SQL Editor > New query > Run. Es seguro ejecutarlo varias veces:
-- si ya tenías la tabla players de la Fase 3, solo añade lo nuevo.
-- =============================================================================

-- ---------------------------------------------------------------- jugadores
create table if not exists public.players (
  -- Mismo id que el usuario de Supabase Auth. Si se borra la cuenta, se borra el progreso.
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null,
  appearance  jsonb       not null default '{}'::jsonb,
  zone_id     text        not null default 'hub',
  x           integer     not null default 5,
  y           integer     not null default 5,
  dir         text        not null default 'down',
  schema      integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Fase 5: simulación de vida
alter table public.players add column if not exists onboarded  boolean not null default false;
alter table public.players add column if not exists job_id     text;
alter table public.players add column if not exists housing_id text;
alter table public.players add column if not exists needs      jsonb  not null default '{}'::jsonb;
alter table public.players add column if not exists inventory  jsonb  not null default '{}'::jsonb;
-- Saldo en Infinitas. NUNCA se escribe directamente: solo con apply_ledger().
alter table public.players add column if not exists balance    bigint not null default 0;
do $$ begin
  alter table public.players add constraint players_balance_nonneg check (balance >= 0);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- libro contable
-- Registro INMUTABLE de todos los movimientos de dinero.
create table if not exists public.ledger (
  id            bigint generated always as identity primary key,
  player_id     uuid        not null references public.players (id) on delete cascade,
  delta         bigint      not null,             -- + ingreso / - gasto
  balance_after bigint      not null,
  reason        text        not null,             -- welcome_grant, housing_deposit, faint_fine...
  ref           text,
  key           text,                             -- clave de idempotencia: la misma clave no se aplica dos veces
  created_at    timestamptz not null default now()
);
create index if not exists ledger_player_idx on public.ledger (player_id, created_at desc);
create unique index if not exists ledger_key_unique on public.ledger (player_id, key) where key is not null;

-- Aplica un ingreso/gasto de forma ATÓMICA.
--  * Si no alcanza el saldo no hace nada y devuelve out_ok = false.
--  * Con una clave repetida devuelve el saldo actual sin volver a aplicar (out_duplicate = true).
create or replace function public.apply_ledger(
  p_player uuid, p_delta bigint, p_reason text, p_ref text default null, p_key text default null
)
returns table (out_ok boolean, out_balance bigint, out_duplicate boolean)
language plpgsql
as $$
declare
  v_balance bigint;
begin
  -- El FOR UPDATE bloquea la fila del jugador: operaciones simultáneas se aplican una tras otra
  select p.balance into v_balance from public.players p where p.id = p_player for update;
  if not found then
    raise exception 'player_not_found';
  end if;

  if p_key is not null and exists (select 1 from public.ledger l where l.player_id = p_player and l.key = p_key) then
    return query select true, v_balance, true;
    return;
  end if;

  if v_balance + p_delta < 0 then
    return query select false, v_balance, false;
    return;
  end if;

  update public.players set balance = v_balance + p_delta where id = p_player;
  insert into public.ledger (player_id, delta, balance_after, reason, ref, key)
  values (p_player, p_delta, v_balance + p_delta, p_reason, p_ref, p_key);

  return query select true, v_balance + p_delta, false;
end;
$$;

-- ---------------------------------------------------------------- seguridad
-- RLS activado SIN políticas = ningún cliente (anon / authenticated) puede leer ni escribir.
-- Solo el servidor del juego, con la service_role key (que se salta RLS), toca estas tablas.
alter table public.players enable row level security;
alter table public.ledger  enable row level security;

revoke all on public.players, public.ledger from anon, authenticated;
revoke all on function public.apply_ledger(uuid, bigint, text, text, text) from public, anon, authenticated;
