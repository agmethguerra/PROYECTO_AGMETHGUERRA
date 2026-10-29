# Infinitylife — Hoja de ruta: simulación de vida

## Visión
Un mundo isométrico persistente, social y online donde cada jugador **vive una vida**: elige su aspecto, su trabajo y dónde vivir según su presupuesto; paga renta, cobra, come, bebe, duerme, sale de fiesta, compra para su casa y progresa. La retención viene de **metas a corto, medio y largo plazo** y de la **gente**, no de trucos.

## Decisiones tomadas
| Tema | Decisión |
|---|---|
| Público | **Solo adultos (+18)**. Casinos, bares y discotecas con temática completa. |
| Dinero | **Solo moneda virtual.** Nada se compra ni se retira con dinero real (evita problemas legales de apuestas y mantiene la economía controlable). |
| Supervivencia | **Las necesidades se pausan al desconectarse.** Nadie pierde por irse a dormir. |
| Orden | Cimientos primero, luego el bucle de vida, luego el ocio. |
| Autoridad | El servidor decide todo (movimiento, dinero, compras, juego). El cliente solo pide y dibuja. |

## Principios de arquitectura
1. **Contenido en datos (JSON)**: empleos, comida, muebles, viviendas, logros, locales y recetas se añaden sin tocar la lógica.
2. **Economía como libro contable (ledger)**: cada movimiento de dinero es una fila inmutable (`quién, cuánto, por qué, cuándo`). El saldo se modifica solo por una función atómica en Postgres. Imposible duplicar dinero ni perder trazabilidad; permite auditar y equilibrar la economía.
3. **Reloj de simulación del servidor**: las necesidades, turnos y rentas avanzan con un tick controlado por el servidor, solo para jugadores conectados.
4. **Bus de eventos**: las acciones (`trabajó`, `compró`, `bebió`, `ganó`...) emiten eventos; logros, misiones y estadísticas los escuchan sin acoplarse.
5. **Zonas como unidad de escala**: cada zona solo recibe y envía a sus jugadores. Las viviendas serán zonas privadas instanciadas.
6. **Seguridad y abuso desde el diseño**: validación en servidor, límites por jugador, registro de auditoría.

## Módulos y diseño

**Necesidades** — hambre, sed, energía, higiene, ánimo (y vejiga si encaja). Bajan con el tiempo jugado, a distinto ritmo; se recuperan con comida, bebida, cama, ducha y ocio. Estados: bien → aviso → crítico (penaliza velocidad, sueldo o ánimo; **nunca "muerte" ni pérdida del progreso**). Al volver tras una ausencia, un pequeño desgaste con tope.

**Economía** — fuentes (sueldos, propinas, logros, premios) y sumideros (renta, comida, muebles, ocio, impuestos de casino). El diseño busca que **ingresos ≈ gastos de una vida normal + margen para ahorrar**; los sumideros crecen con el nivel para evitar inflación.

**Trabajo** — empleos por categoría (oficina, bar, discoteca, tienda, reparto...). Turnos con tareas en el mundo y sueldo por turno/hora. Los empleos de cara al público **cobran propinas de jugadores reales** (barista, camarero, DJ); los de oficina, no. Niveles de ascenso por horas y logros.

**Vivienda y renta** — al empezar el jugador elige vivienda según su presupuesto inicial (cuarto compartido → depa → casa). La renta se cobra por periodos de juego; si falta dinero, hay **aviso y gracia**, luego mudanza a una vivienda inferior (no expulsión definitiva). Decorable con muebles del súper/tienda.

**Onboarding** — Avatar → trabajo → vivienda según presupuesto → primer turno guiado. Debe dejar al jugador con una meta inmediata en menos de 5 minutos.

**Chat y seguridad social**
- *Filtro de vocabulario*: lista local en español/inglés con normalización (mayúsculas, acentos, `l33t`, letras repetidas, espacios entre letras). Niveles: censurar, bloquear el mensaje, advertencia/strikes, silencio temporal. Registro de infracciones y botón de **reportar**. Mejorable más adelante con un servicio de moderación por IA.
- *Chat privado*: solo entre jugadores que se aceptaron (solicitud → aceptar), con **bloqueo**, silenciar, y opción de no recibir de desconocidos. Capas de permiso: global → zona → privado → grupo. Límites de velocidad y de longitud.
- *+18*: confirmación de edad en el registro. Una casilla **no verifica** la edad realmente; si se publica, habrá que valorar verificación y asesoría legal.

**Comercio y casa** — supermercado (comida y artículos del hogar), tienda de muebles, inventario y colocación en la vivienda.

**Ocio** — bares (bebidas con efectos en ánimo/necesidades), discotecas (aforo, música, ambiente social, entrada), casinos con **fichas virtuales**: probabilidades definidas en datos y auditables, límite diario de pérdida, descansos y autoexclusión. Las fichas no se convierten en dinero real.

**Logros y recompensas** — logros desbloqueados por eventos (primer sueldo, 7 días seguidos, mejor propina...), recompensa diaria con racha suave (sin castigo duro), títulos y cosméticos.

## Fases
| Fase | Contenido | Estado |
|---|---|---|
| 1–2 | Base, multijugador, chat, avatar | ✅ |
| 3 | Login y progreso (Supabase) + despliegue (Vercel) | ✅ |
| 4 | Mundo: A\* en servidor, alturas, objetos, zonas | ✅ |
| **5** | **Simulación base**: libro contable, Infinitas, necesidades y salud, reloj, HUD, onboarding (avatar → empleo → vivienda), casa privada, comer/beber/dormir/baño/ducha | ✅ **esta entrega** |
| 6 | Chat moderado + chats privados con permisos, bloqueos y reportes | |
| 7 | Trabajo, sueldos, propinas y cobro de renta (la elección de empleo/vivienda y el depósito ya existen desde la Fase 5) | |
| 8 | **Mercado** (comprar raciones) y **tienda Souvenir** (decoración), inventario y decoración de casa | |
| 9 | **Discoteca** y **casino** (fichas virtuales, límites responsables), bares | |
| 10 | Logros, recompensas diarias y estadísticas | |
| 11 | NPCs, misiones y crafteo | |
| 12 | Pulido: balance económico, anti-abuso, rendimiento, observabilidad | |

Cada fase se entrega funcionando y probada antes de avanzar, como acordamos.

## Riesgos que vigilo
- **Escala**: hoy hay un único proceso con el mundo en memoria. Aguanta cientos de jugadores; para más habrá que repartir zonas entre procesos.
- **Inflación y exploits**: de ahí el libro contable, los límites y probar la economía con simulaciones antes de abrirla.
- **Falsos positivos del filtro**: se afinará con datos reales y revisión de reportes.
- **Casinos y alcohol**: aunque sea moneda virtual, algunas jurisdicciones regulan los "casinos sociales" y el contenido de alcohol. Conviene consultarlo antes de lanzar públicamente.
- **Alcance**: es un proyecto enorme; por eso el orden por fases y el contenido en datos.

## Parámetros fijados por ti (Fase 5)
- Moneda: **Infinitas** (símbolo: infinito vertical plateado de dos pentágonos). Inicio: **150**.
- 1 día del juego = **7 horas reales**.
- Hambre: de 100 a 0 en **2 h reales**. Sed: 15 s por punto. Vejiga: 10 s por punto. (Todo editable en `data/needs/needs.json`.)
- Salud 0–100: una necesidad en 0 la daña, y **cuanto más tiempo siga en 0, más rápido baja**.
- Orden de lugares: **vivienda propia → mercado → souvenir → discoteca → casino**.

## Para la Fase 6 necesitaré de ti
- Listas de palabras: ¿quieres que parta de una lista base en español/inglés que yo prepare y tú ajustas?
- Castigo por insultos: censurar, bloquear el mensaje, strikes y silencio temporal (propongo los cuatro, en escalera).
