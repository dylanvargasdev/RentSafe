# RentSafe

Marketplace de alquiler entre personas y empresas: **alojamiento, vehículos, tecnología y equipo de trabajo**. El alquiler y el depósito de garantía esperan en un **escrow en Stellar** (Trustless Work) hasta que ambas partes cumplen, y el acuerdo queda en un **contrato Soroban propio** (`rental_registry`) que impide reservas solapadas y la reutilización de escrows. Los usuarios entran con correo o Google gracias a **Cavos**, o con Freighter.

```bash
npm run setup:tools && npm install
npm run doctor              # crea app/.env
npm run contracts:build     # despliega rental_registry en testnet
npm start                   # http://localhost:5173
```

Guía completa (arquitectura, diseño del escrow, variables de entorno, prueba en testnet y estado real de cada integración): [`docs/RENTSAFE.md`](docs/RENTSAFE.md).

---

# Scaffold Stellar × Trustless Work × Cavos

Plantilla para construir aplicaciones descentralizadas (dApps) en Stellar con la ayuda de un agente de código.

Construida sobre [Scaffold Stellar](https://stellarscaffold.org), de [The Aha Company](https://theaha.co).

## Configuración con tu agente

Copia este prompt en tu agente de código (Claude Code, Codex, Cursor, OpenCode, Copilot u otro), desde una carpeta vacía o desde tu copia de este repositorio. El agente instala lo necesario, despliega los contratos en testnet, levanta la aplicación y te explica cómo está organizado el proyecto.

```markdown
# Configuración de scaffold-stellar-agentic

Configura este proyecto de Stellar y explícamelo. Ejecuta los comandos tú mismo;
pregúntame solo cuando necesites una decisión o una clave.

1. Proyecto
   - Si la carpeta actual contiene `AGENTS.md`, trabaja aquí.
   - Si no, pregúntame si quiero mi propio repositorio en GitHub. Si respondo que sí y
     `gh` está autenticado, pregúntame el nombre y la visibilidad y ejecuta:
     `gh repo create <nombre> --template bitfalt/scaffold-stellar-agentic --private --clone`
     (o `--public`). Si no, clona https://github.com/bitfalt/scaffold-stellar-agentic.git
     dentro de la carpeta actual (en `scaffold-stellar-agentic/`).
   - Entra a la carpeta del proyecto, lee `AGENTS.md` y sigue sus reglas durante toda la
     sesión.
2. Herramientas: ejecuta `npm run setup:tools` (Stellar CLI y plugin de Scaffold, con
   binarios precompilados) y luego `npm install`. Si una descarga falla por la red,
   vuelve a intentarlo fuera del sandbox. Ignora las advertencias de `npm audit`. En
   Windows, recomiéndame usar WSL2. Si eres Claude Code y `.claude/skills` contiene
   archivos de texto en lugar de carpetas, ejecuta `npm run agents:sync`.
3. Diagnóstico: ejecuta `npm run doctor` y corrige cada error antes de continuar. Las
   advertencias son opcionales.
4. Claves en `app/.env`. Pídemelas; nunca me pidas llaves secretas ni frases semilla. Si
   no tengo alguna, continúa sin ella.
   - `PUBLIC_CAVOS_APP_ID` (opcional): permite iniciar sesión con correo o Google. Se
     crea una app en https://cavos.xyz/dashboard, se copia su App ID y se agrega
     `http://localhost:5173` en "allowed web origins".
   - `PUBLIC_TRUSTLESS_WORK_API_KEY` (solo si voy a usar escrows): en
     https://dapp.trustlesswork.com, Settings (completar "Use case"), API Keys, pestaña
     Testnet.
5. Contratos: ejecuta `npm run contracts:build` (compila, despliega en testnet y genera
   los clientes TypeScript) y después `npm run check`. Ambos deben terminar sin errores.
6. Aplicación: inicia `npm start` en segundo plano, espera a que el log diga
   `Successfully generated client` y confirma que http://localhost:5173 responde. El
   puerto es fijo: si está ocupado, Vite se detiene con un mensaje y debes pedirme que
   cierre el otro servidor. Dime cómo detener la aplicación cuando termine.
7. Explícame el proyecto en mi idioma, en no más de diez líneas: qué aportan Scaffold
   Stellar, Trustless Work y Cavos, cómo se conectan, qué puedo probar ahora en el
   navegador (con Freighter en Testnet o con Cavos) y qué skills hay en
   `.agents/skills`.
8. Pregúntame qué quiero construir y usa la skill `build-dapp` para hacerlo.
```

Funciona con cualquier modelo y cualquier agente: las instrucciones viven en `AGENTS.md` y `.agents/skills`, que todos pueden leer.

**Empezar un proyecto nuevo:** en GitHub, **Use this template → Create a new repository**, o desde la terminal:

```bash
gh repo create mi-dapp --template bitfalt/scaffold-stellar-agentic --private --clone
```

**Construir algo:** con el proyecto listo, describe tu idea:

```text
/build-dapp Quiero una app de votaciones para mi comunidad: cualquiera crea una
encuesta, cada persona vota una vez y se ven los resultados en vivo. Que la gente
entre con su correo.
```

## Qué incluye

| Componente | Descripción |
| --- | --- |
| [Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar) | Contratos Soroban (Rust) y una aplicación React. Cada vez que guardas un contrato, se compila, se despliega en testnet y se genera un cliente TypeScript tipado. |
| [Trustless Work](https://docs.trustlesswork.com) | Escrows listos para usar, para los casos en que el dinero debe esperar una condición: el USDC queda en un contrato y se libera cuando se aprueban los hitos. |
| [Cavos](https://docs.cavos.xyz) | Wallets embebidas: los usuarios inician sesión con correo o Google y obtienen una cuenta Stellar sin instalar extensiones. La llave pertenece al usuario y se guarda en un entorno aislado al que ni la aplicación ni Cavos tienen acceso. |
| Skills para agentes | Instrucciones verificadas en `AGENTS.md` y `.agents/skills/` para que cualquier agente construya sobre estas piezas sin inventar APIs. |
| Servidores MCP | [Stellar Raven](https://raven.stellar.org) (documentación y ecosistema de Stellar), documentación de Trustless Work y el asistente de contratos de OpenZeppelin, ya configurados para los principales agentes. Stellar Raven pide iniciar sesión en el navegador la primera vez. |
| Escrow Studio (`/escrows`) | Interfaz para crear, fondear, aprobar, liberar, disputar y resolver escrows, con una guía para preparar la cuenta. |
| Contrato `reputation` | Contrato de ejemplo con reseñas on-chain ligadas a cada escrow: almacenamiento, permisos, errores, eventos y tests. |
| Scripts | `setup:tools` (instala herramientas sin compilar), `doctor` (diagnóstico), `check` (tests, formato, tipos y lint), `tw:smoke` (prueba de escrows de punta a punta). |

No todas las aplicaciones necesitan los tres componentes. Una aplicación de votaciones, por ejemplo, es un contrato Soroban con inicio de sesión por correo y no usa escrows. El agente elige los componentes según la idea.

Todo funciona en **testnet**, la red de pruebas de Stellar: los fondos no tienen valor real.

## Construido sobre Scaffold Stellar

Este proyecto existe gracias a [Scaffold Stellar](https://github.com/stellar-scaffold/cli), el proyecto open source de [The Aha Company](https://theaha.co) y su comunidad. De Scaffold Stellar provienen la estructura del proyecto, la aplicación en Vite y React, la conexión con wallets, la generación automática de clientes TypeScript y el flujo que compila y despliega los contratos en cada cambio.

Este repositorio agrega los escrows de Trustless Work, el inicio de sesión con Cavos, el contrato de reputación, los scripts de apoyo y las skills para agentes. Si te resulta útil, considera dar una estrella a [stellar-scaffold/cli](https://github.com/stellar-scaffold/cli) y consulta su [documentación](https://stellarscaffold.org).

## Arquitectura

```
                     Tu usuario
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
       "Sign in"                 "Use a wallet"
    correo o Google            Freighter, xBull…
        (Cavos)              (Stellar Wallets Kit)
           │                           │
           └─────────────┬─────────────┘
                         ▼
                    useWallet()
        una sola forma de firmar en toda la app
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
     Trustless Work           Tus contratos Soroban
       (escrows)               (Scaffold Stellar)
```

Toda la aplicación firma a través de `useWallet()`, por lo que funciona igual con inicio de sesión por correo o con una extensión: votar en un contrato, crear y fondear escrows, dejar reseñas on-chain o agregar la trustline de USDC. Cada aplicación puede usar sus propios contratos, escrows o ambos.

## Configuración manual

### Requisitos

- [Node.js](https://nodejs.org) 22 o superior
- [Rust con rustup](https://rustup.rs)
- git
- Un agente de código (Claude Code, Codex, Cursor, OpenCode, Copilot u otro)
- Wallet: ninguna si usas el inicio de sesión con correo o Google, o [Freighter](https://freighter.app) si prefieres una extensión

En Windows se recomienda WSL2.

### 1. Crear tu copia

En GitHub, selecciona **Use this template → Create a new repository** (o haz un fork) y clona tu copia:

```bash
git clone https://github.com/<tu-usuario>/<tu-repo>.git
cd <tu-repo>
```

### 2. Instalar las herramientas

```bash
npm run setup:tools   # Stellar CLI y plugin de Scaffold (binarios precompilados)
npm install           # dependencias del proyecto
npm run doctor        # crea app/.env e indica qué falta
```

### 3. Configurar las claves

Ambas se guardan en `app/.env` y son opcionales según lo que use tu aplicación.

**Trustless Work** (solo si tu aplicación usa escrows, y para probar el Escrow Studio):

1. Entra a [dapp.trustlesswork.com](https://dapp.trustlesswork.com) y conecta una wallet.
2. Abre tu dirección (abajo a la izquierda) → **Settings** y completa tu perfil. El campo _Use case_ es obligatorio.
3. Ve a **API Keys** → pestaña **Testnet** → **Request API Key** y cópiala; se muestra una sola vez.
4. Agrégala como `PUBLIC_TRUSTLESS_WORK_API_KEY="..."`.

**Cavos** (inicio de sesión con correo o Google):

1. En el [dashboard de Cavos](https://cavos.xyz/dashboard), crea una aplicación y copia su **App ID**.
2. En **Settings → allowed web origins**, agrega `http://localhost:5173`. Para iniciar sesión con Google, agrégalo también en **Callback URLs**.
3. Agrégalo como `PUBLIC_CAVOS_APP_ID="..."`.

> El App ID de Cavos es público por diseño y no es un secreto: si alguien ya te compartió uno, puedes usarlo. Sin App ID, la aplicación funciona solo con wallets de extensión.

### 4. Iniciar la aplicación

```bash
npm start
```

Abre [localhost:5173](http://localhost:5173). La primera ejecución tarda uno o dos minutos mientras se despliega el contrato en testnet. Si al inicio aparecen errores de `app-lib/clients`, espera a que termine. El puerto 5173 es fijo (Cavos solo acepta los orígenes registrados): si está ocupado, cierra el otro servidor.

### 5. Preparar tu cuenta

Selecciona **Sign in** (correo o Google) o **Use a wallet** (Freighter en **Testnet**) y luego **Fund Account** para recibir XLM de prueba mediante Friendbot. Con eso puedes usar cualquier contrato.

Para probar escrows, abre **Escrow Studio** y sigue la guía: **Add trustline** → **Swap 100 XLM → USDC**.

> Si iniciaste sesión con Cavos, usa Friendbot antes que cualquier otra acción: la cuenta nueva necesita XLM de prueba para pagar las comisiones. Al firmar acciones en contratos o escrows, Cavos muestra su propia ventana de aprobación.

## Construir con prompts

Abre el repositorio con tu agente y describe tu idea. El agente lee `AGENTS.md` y las skills, elige solo los componentes que la idea necesita, propone un plan y lo construye paso a paso. Antes de empezar, pregunta qué datos conviene guardar on-chain y cuáles no, y explica las ventajas y desventajas de cada opción (por ejemplo: on-chain nadie puede alterar un dato, pero es público de forma permanente).

| Agente | Cómo usa este repositorio |
| --- | --- |
| Claude Code | Lee `CLAUDE.md`, que importa `AGENTS.md`. Las skills están disponibles como `/build-dapp`, `/cavos`, `/trustless-work`, etc. |
| Codex CLI | Lee `AGENTS.md` y `.agents/skills` (`$build-dapp`). |
| Cursor | Lee `AGENTS.md` y `.agents/skills` (`/build-dapp`). |
| GitHub Copilot | Lee `AGENTS.md` y `.agents/skills`. |
| Gemini CLI / Antigravity | Carga `AGENTS.md` (mediante `.gemini/settings.json`) y `.agents/skills`. |
| OpenCode, Pi, Windsurf, Aider y otros | Leen `AGENTS.md`, que indica qué `SKILL.md` abrir para cada tarea. |

Más detalles por herramienta y servidores MCP opcionales en [`docs/AGENT-SETUP.md`](docs/AGENT-SETUP.md).

Ejemplos de ideas:

- _"Quiero una app de votaciones para mi comunidad: cualquiera crea una encuesta y cada persona vota una vez."_ (sin escrows)
- _"Haz un libro de visitas para mi evento donde la gente inicie sesión con su correo y deje un mensaje."_ (sin escrows)
- _"Quiero una app para vender distintos artículos usando escrows. Los compradores inician sesión con su correo."_
- _"Haz una app de depósitos de alquiler: el inquilino deposita en un escrow y el propietario aprueba la devolución al final del contrato."_
- _"Crea una página de bounties de hackathon: cada premio es un hito con su ganador; los jueces aprueban y liberan."_
- _"Agrega un contrato Soroban de perfiles públicos (nombre, habilidades, enlaces) y muestra la reputación junto a cada escrow."_
- _"Explícame qué ocurre on-chain cuando fondeo un escrow."_

Más ideas, con y sin escrows, en [`ideas.md`](.agents/skills/build-dapp/references/ideas.md).

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm start` | Modo desarrollo: compila y despliega los contratos en testnet, genera sus clientes e inicia la aplicación. |
| `npm run doctor` | Revisa herramientas, `app/.env`, la red y las claves de Trustless Work y Cavos. |
| `npm run check` | Tests de los contratos, formato, revisión de tipos y lint. |
| `npm run contracts:build` | Compila, despliega y genera los clientes una sola vez. |
| `npm run tw:smoke` | Prueba real de un escrow de punta a punta, sin navegador. |
| `npm run build` | Build de producción de la aplicación (`app/dist`). |
| `npm run agents:sync` | Sincroniza las skills hacia `.claude/skills`. |

## Estructura

```
AGENTS.md               instrucciones para cualquier agente (CLAUDE.md lo importa)
.agents/skills/         skills (fuente de verdad; .claude/skills apunta aquí)
contracts/reputation/   contrato Soroban de ejemplo y sus tests
environments.toml       qué contratos se despliegan y dónde (development = testnet)
app/src/pages/          páginas: Home, Escrows (Escrow Studio), contratos desplegados
app/src/cavos/          inicio de sesión con correo o Google y wallet embebida (Cavos)
app/src/providers/      WalletProvider: un único useWallet() para Cavos y extensiones
app/src/trustless/      escrows de Trustless Work (configuración, hooks, componentes)
app-lib/                red, wallets de extensión, friendbot y eventos
app-lib/clients/        clientes generados de tus contratos (no se editan)
scripts/                install-tools, doctor, contracts-build, tw-smoke, agents-sync, ...
docs/AGENT-SETUP.md     configuración por agente y servidores MCP opcionales
```

## Solución de problemas

Ejecuta `npm run doctor` y consulta la [guía de problemas comunes](.agents/skills/scaffold-stellar/references/troubleshooting.md) y la [skill de Cavos](.agents/skills/cavos/SKILL.md). También puedes pegarle el error a tu agente: las skills incluyen un decodificador de errores.

## Versiones

- `stellar-scaffold-cli` **0.0.27** con la configuración **v1** (`environments.toml`). El template oficial de Scaffold ya usa un formato nuevo (v2) que esta versión del CLI no soporta, por eso este repositorio se distribuye ya generado y no es necesario ejecutar `stellar scaffold init`.
- `@trustless-work/escrow` **3.0.5** (API V1, estable).
- `@cavos/kit` **0.2.5**.
- `soroban-sdk` **26.1** y OpenZeppelin `stellar-*` **0.7.2**.

## Comparte tu proyecto

Publica tu repositorio en [Discussions → Show and tell](https://github.com/bitfalt/scaffold-stellar-agentic/discussions/categories/show-and-tell) con una captura de lo que construiste.

## Créditos y licencias

Basado en el template oficial de [Scaffold Stellar](https://github.com/stellar-scaffold/ui), de The Aha Company y sus contribuidores (Apache-2.0). El detalle de qué proviene del template y qué se modificó está en [`NOTICE`](NOTICE). Incluye la [skill oficial de Trustless Work](https://github.com/Trustless-Work/trustlesswork-skill) (Apache-2.0) en `.agents/skills/trustless-work/references/official/`. Usa [`@cavos/kit`](https://docs.cavos.xyz) (MIT) y [`@trustless-work/escrow`](https://www.npmjs.com/package/@trustless-work/escrow). Este repositorio se distribuye bajo la licencia Apache-2.0.
