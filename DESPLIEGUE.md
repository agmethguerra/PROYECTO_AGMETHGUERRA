# Supabase + Vercel (Fase 3, versión de producción)

## Cómo queda armado
```
Navegador ──(web estática)──────────▶ Vercel          client/ + shared/ + data/ + config.json
    │  └──(login)───────────────────▶ Supabase Auth
    └─────(WebSocket wss://)────────▶ Servidor del juego (Render / Railway / Fly)
                                         └─(API REST, service_role)─▶ Supabase Postgres (tabla players)
```
**Por qué el servidor no va en Vercel:** Vercel solo ejecuta funciones que viven unos segundos; no pueden mantener WebSockets abiertos ni el mundo en memoria. Por eso Vercel sirve la web y el servidor Node (`npm start`) corre en un host persistente. El servidor sigue siendo la autoridad de todo.

## Qué cambió respecto a Firebase
- Se eliminó Firebase por completo. Login con **Supabase Auth** (correo + Google), progreso en **Postgres** (`supabase/schema.sql`).
- El servidor habla con Supabase por REST (`fetch`), sin SDK: `server/services/supabase.js` y `server/storage/SupabaseStore.js`.
- El cliente carga `@supabase/supabase-js` desde el CDN y lee su configuración de `/config.json`.
- Nuevo: `scripts/build-client.js` + `vercel.json` (build de Vercel), `render.yaml`, `/health`, y `ALLOWED_ORIGINS` (solo tu web puede abrir WebSocket).
- El modo desarrollo sigue igual: sin `SUPABASE_URL` todo funciona con login simulado y `.data/players.json`.

## 0) Probar en local (sin cuentas)
```bash
npm install
npm run dev     # http://localhost:8080  -> modo desarrollo
```

## 1) Supabase
1. https://supabase.com → **New project**.
2. **SQL Editor → New query**: pega `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: activo. Para pruebas puedes desactivar *Confirm email*; si lo dejas activo, el registro pide confirmar el correo (la pantalla ya lo avisa).
4. **Google** (opcional): Authentication → Providers → Google; sigue ahí las instrucciones para crear el *OAuth client* en Google Cloud y copia su *Callback URL* (`https://<proyecto>.supabase.co/auth/v1/callback`) a Google.
5. **Project Settings → API**: apunta `Project URL`, `anon public` y `service_role` (esta última es **secreta**).
6. Más tarde, con tu dominio de Vercel: **Authentication → URL Configuration** → *Site URL* = tu web, y añade `http://localhost:8080` y tu web a *Redirect URLs*.

## 2) Servidor del juego (Render como ejemplo)
1. Sube el proyecto a GitHub. En Render: **New → Blueprint** (usa `render.yaml`) o **New Web Service**: build `npm install`, start `npm start`, health check `/health`.
2. Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV=production`.
   `ALLOWED_ORIGINS` la completas en el paso 4.
3. Al arrancar debe verse `[Supabase] Conectado a ...`. Si la clave o la tabla están mal, **no arranca** y dice por qué.
4. Apunta la URL pública (ej. `https://infinitylife-server.onrender.com`).
> El plan gratuito de Render se duerme tras 15 min sin visitas y corta los WebSocket. Para jugar de verdad usa un plan que no se duerma (Starter) o Railway/Fly.

## 3) Vercel (cliente)
1. **Add New → Project**, importa el repo. *Root Directory*: la carpeta del proyecto (la que contiene `package.json`). El resto lo toma de `vercel.json`.
2. **Environment Variables** (todas públicas; **no** pongas el service_role):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GAME_SERVER_URL` = la URL del paso 2 (`https://…`, se convierte sola en `wss://…`)
3. **Deploy**. Si falta una variable el build **falla** con un mensaje claro en vez de publicar una web rota.

## 4) Cerrar el círculo
- En el servidor: `ALLOWED_ORIGINS=https://tu-proyecto.vercel.app` (varias separadas por comas, sin barra final). Los *preview deployments* de Vercel tienen otro dominio; añádelos si quieres probarlos.
- En Supabase: completa *Site URL* / *Redirect URLs* (paso 1.6).
- Si cambias una variable de Vercel, haz **Redeploy** (se leen al construir).

## Comprobar que va bien
1. Abre tu web de Vercel → pantalla de login **sin** aviso de "modo desarrollo".
2. Regístrate, muévete, pulsa **Salir** y vuelve a entrar: apareces donde lo dejaste. En Supabase → *Table Editor → players* ves tu fila.
3. Abre otra pestaña con la misma cuenta: la primera se cierra.

## Seguridad (resumen)
- `service_role` solo en el servidor. La tabla `players` tiene RLS sin políticas: el navegador no puede leer ni escribir; todo pasa por el servidor.
- El servidor verifica cada token con Supabase Auth; en producción el login `dev:` no existe.
- `ALLOWED_ORIGINS` limita quién abre WebSockets; mensajes de máx. 16 KB y 5 intentos de login por conexión.

## Probado y no probado
Probado con un Supabase simulado: login, guardado/carga en la tabla, sesión única, origen permitido, claves erróneas, build de Vercel y cliente en otro dominio. **No probado contra un proyecto real de Supabase ni de Vercel**, ni el SDK real desde el CDN, ni el login con Google: si algo falla en el primer despliegue, revisa los logs del servidor y la consola del navegador.
