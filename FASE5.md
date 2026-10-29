# Fase 5 — Simulación de vida (base)

## Qué hay de nuevo
- **Moneda: Infinitas.** Símbolo: infinito vertical plateado (`client/assets/ui/infinita.svg`). Cada cuenta nueva recibe **150** una sola vez.
- **Libro contable.** Todo movimiento de dinero queda registrado (`ledger`) y el saldo nunca baja de 0. Los reintentos no duplican nada (clave de idempotencia).
- **Necesidades y salud (0–100).** Hambre, sed, vejiga, energía, higiene. Una necesidad en 0 daña la salud y **el daño crece cuanto más tiempo sigue en 0**. Con la salud en 0 el personaje se desmaya: multa de 20 Infinitas, vuelve a casa y se recupera.
- **Se pausan al desconectarte** (solo corren mientras estás dentro).
- **Reloj del juego:** 1 día = 7 horas reales, igual para todos.
- **Asistente inicial** (cuenta nueva): avatar → empleo → vivienda (se cobra el depósito).
- **Casa privada** por jugador (cuarto / departamento / casa). Entras por la puerta del hub (esquina inferior).
- **Acciones con tiempo** sobre objetos (clic en el objeto): comer (nevera, gasta 1 ración), beber (lavabo), baño, ducha, dormir (cama). Moverte las cancela. Los demás ven tu estado ("Durmiendo").
- Los invitados también tienen necesidades y 150 Infinitas, pero solo en memoria (sin casa).

## Tus parámetros (editar sin tocar código)
| Qué | Dónde |
|---|---|
| Velocidad de cada necesidad (`secondsPerPoint`), daño a la salud, regeneración, desmayo | `data/needs/needs.json` |
| Nombre de la moneda y saldo inicial | `data/economy.json` |
| Duración de cada acción y sus efectos | `data/interactions/interactions.json` |
| Empleos / viviendas (precios) | `data/jobs/jobs.json`, `data/housing/housing.json` |
| Duración del día | `shared/config/time.js` |

Valores actuales: hambre 72 s/punto (2 h), sed 15 s/punto, vejiga 10 s/punto, energía 180 s/punto, higiene 144 s/punto.
> Interpreté "una necesidad del 1 10 seg, y del 2 15 seg" como **vejiga 10 s** y **sed 15 s** por punto. Si querías otras, cámbialas en `needs.json`.

## Para activarlo en Supabase
1. **Vuelve a ejecutar `supabase/schema.sql`** en el SQL Editor (es seguro repetirlo; añade columnas y la función `apply_ledger`). Si habías creado las tablas `wallets`/`ledger` de una versión de prueba anterior, puedes borrarlas.
2. Despliega el servidor y el cliente como antes. No hay variables nuevas.
3. Las cuentas ya existentes de la Fase 3/4 verán el asistente inicial la próxima vez que entren.

## Probar en local
`npm start` → `http://localhost:8080` → "Entrar como invitado" o crea una cuenta de desarrollo. Con `?debug` en la URL, `window.__game` queda disponible.

## Aún no incluido (por diseño)
- **Cobro automático de renta y sueldos, propinas y trabajar:** Fase 7 (ya eliges empleo/vivienda y pagas depósito).
- **Mercado** (comprar raciones; hoy empiezas con 8), **Souvenir**, **discoteca** y **casino**: Fases 8–9, en ese orden.
- Muebles decorables y persistencia de la casa: Fase 8.

## Verificado
Postgres 16 real (idempotencia, saldo no negativo, 20 cobros simultáneos → exactamente los que alcanzan, RLS bloquea a `anon`); flujo completo por WebSocket en modo desarrollo y con Supabase simulado; navegador real (onboarding, menú de objetos, comer).
