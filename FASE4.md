# Fase 4 — Mapas, A* en servidor, alturas y objetos

## Qué cambia
- **El servidor mueve a los jugadores.** Antes aceptaba cualquier celda como destino (teletransporte). Ahora calcula una ruta **A\*** sobre el mapa real y avanza **una celda cada 200 ms** (`MOVE_SPEED`). Spamear peticiones no acelera. Rutas máximas de 80 celdas.
- **Alturas (`heightMap`)**: solo se puede pasar entre celdas contiguas con ≤ 1 nivel de diferencia (`MAX_STEP_HEIGHT`). Hay que usar escaleras; un salto de 2 niveles es un muro.
- **Objetos de mapa** (`data/objects/definitions.json` + `objects` en cada mapa): pilar, caja, mesa (bloquean), alfombra (no bloquea). Añadir tipos o colocarlos es solo editar JSON.
- **Salidas**: se llega caminando; solo se activan como destino (nunca "de paso").
- **Cliente**: dibuja niveles y objetos con orden de profundidad correcto (un avatar queda detrás/delante de un pilar o una plataforma según su posición), sube y baja escaleras suavemente, selecciona la celda correcta sobre suelos elevados y muestra un anillo en el destino. Si no hay camino lo dice en el chat.
- **Zona nueva "Terraza"** (desde el Hub, casilla blanca de abajo a la derecha): plataforma a nivel 3 con escalera, saliente a nivel 2 *sin* escalera (inalcanzable a propósito), pilares, mesa y cajas.
- Cambios aditivos en datos existentes: objetos en hub, zona A y zona B, y una salida extra en el hub hacia la Terraza.

## Archivos
Nuevos: `server/systems/MovementSystem.js`, `client/js/iso/pick.js`, `client/js/render/objects.js`, `data/objects/definitions.json`, `data/maps/zone_c.json`, `ROADMAP.md`.
Reescritos/ampliados: `server/pathfinding/astar.js`, `server/managers/ZoneManager.js`, `server/network/handlers/move.js`, `client/js/render/{renderer,tiles,entities}.js`, `client/js/world/entities.js`, `client/js/core/game.js`, `client/js/input/mouse.js`.
`server/validation/movement.js` ya no se usa (se deja por si quieres borrarlo).

## Probarlo
```bash
npm run dev      # http://localhost:8080
```
1. Entra, y haz clic en una celda lejana: el avatar **camina** por una ruta (rodea paredes, pilares y mesas).
2. Ve a la casilla blanca de abajo a la derecha del Hub → **Terraza**. Sube por la escalera (clic en la plataforma): la cámara y el avatar suben.
3. Haz clic en el saliente bajo (izquierda) o en un pilar: "No hay camino…" / "Ese sitio está ocupado".
4. Abre con otro navegador la misma zona: ves al otro avatar caminar celda a celda.
5. Depuración: `http://localhost:8080/?debug` expone `window.__game` en la consola; `G` muestra la cuadrícula.

## Lo que viene
**Fase 5 — simulación base** (ver `ROADMAP.md`): libro contable de dinero, necesidades, reloj de juego, HUD y onboarding.
