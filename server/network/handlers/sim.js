// Mensajes de la simulación de vida: estado, onboarding e interacciones con objetos.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { EVENTS } from "../../../shared/config/events.js";
import { createMessage } from "../../../shared/protocol/messages.js";
import { publicNeeds } from "../../systems/NeedsSystem.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readData = (f) => JSON.parse(readFileSync(join(__dirname, "../../../data", f), "utf-8"));
const JOBS = readData("jobs/jobs.json").jobs;
const CURRENCY = readData("economy.json").currency;

export const getJob = (id) => JOBS.find((j) => j.id === id) || null;

export function sendSimState(world, send, ws, player) {
  const home = world.homeManager.get(player.housingId);
  const job = getJob(player.jobId);
  send(ws, createMessage(EVENTS.SIM_STATE, {
    ...publicNeeds(player.needs),
    balance: player.balance,
    inventory: player.inventory || {},
    currency: { name: CURRENCY.name, singular: CURRENCY.singular },
    job: job ? { id: job.id, name: job.name } : null,
    housing: home ? { id: home.id, name: home.name, rentPerGameDay: home.rentPerGameDay } : null,
    serverNow: Date.now()
  }));
}

export function sendOnboardingRequired(world, send, ws, player) {
  send(ws, createMessage(EVENTS.ONBOARDING_REQUIRED, {
    currency: { name: CURRENCY.name, singular: CURRENCY.singular },
    balance: player.balance,
    jobs: JOBS,
    housing: world.homeManager.housing.map(({ template, ...h }) => h),
    appearance: player.appearance
  }));
}

/** El cliente termina el asistente inicial: avatar + empleo + vivienda (se paga el depósito). */
export async function handleOnboardingComplete(ctx, ws, socketId, payload) {
  const { world, send, teleportHome } = ctx;
  const player = world.playerManager.getPlayer(world.roomManager.getPlayerId(socketId));
  if (!player || player.guest || player.onboarded !== false || player._onboarding) return;
  const fail = (message) => send(ws, createMessage(EVENTS.ONBOARDING_ERROR, { message }));

  const job = getJob(payload?.jobId);
  const home = world.homeManager.get(payload?.housingId);
  if (!job) return fail("Elige un empleo.");
  if (!home) return fail("Elige una vivienda.");
  if (!payload?.appearance) return fail("Falta tu avatar.");

  player._onboarding = true; // evita doble envío mientras se cobra
  try {
    const paid = await world.economy.debit(player, home.deposit, "housing_deposit", {
      ref: home.id, key: `housing_deposit:${player.uid}`
    });
    if (!paid.ok) return fail(`No te alcanzan las ${CURRENCY.name} para el depósito (${home.deposit}).`);

    player.appearance = world.appearanceManager.validateAppearance(payload.appearance);
    player.jobId = job.id;
    player.housingId = home.id;
    player.onboarded = true;
    player._needsAt = Date.now(); // las necesidades empiezan a correr ahora
    send(ws, createMessage(EVENTS.APPEARANCE_UPDATE, { appearance: player.appearance }));
    await ctx.profileManager.savePlayer(player, { force: true });
    teleportHome(player);
    sendSimState(world, send, ws, player);
    console.log(`[Onboarding] ${player.name}: ${job.id} / ${home.id}`);
  } catch (e) {
    console.error("[Onboarding]", e);
    fail("Error guardando tu elección. Inténtalo de nuevo.");
  } finally {
    player._onboarding = false;
  }
}

export function handleObjectInteract(world, socketId, payload) {
  const player = world.playerManager.getPlayer(world.roomManager.getPlayerId(socketId));
  if (!player || player.onboarded === false) return;
  world.activitySystem.start(player, { objectId: payload?.objectId, action: payload?.action });
}

export function handleActivityCancel(world, socketId) {
  const player = world.playerManager.getPlayer(world.roomManager.getPlayerId(socketId));
  if (player) world.activitySystem.cancel(player);
}
