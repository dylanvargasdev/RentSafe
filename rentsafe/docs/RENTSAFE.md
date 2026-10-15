# RentSafe: guía técnica

Marketplace de alquiler entre personas y empresas (alojamiento, vehículos,
tecnología y equipo de trabajo) donde el alquiler y el depósito de garantía
esperan en un escrow en Stellar hasta que ambas partes cumplen.

Construido sobre `scaffold-stellar-agentic` (Scaffold Stellar + Trustless Work +
Cavos). Todo funciona en **Stellar testnet**.

## 1. Qué hay implementado

| Área                                                                                                                                                    | Estado                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Inicio con buscador, destacados, populares, alquilados recientemente, cómo funciona, protección del depósito, CTA a propietarios, footer                | Hecho                                                |
| Cuatro categorías con vista propia y filtros específicos por categoría                                                                                  | Hecho                                                |
| Buscador y filtros (ubicación, fechas, categoría, precio, disponibilidad, orden y atributos) que filtran de verdad y viven en la URL                    | Hecho                                                |
| Detalle con galería, características, requisitos, disponibilidad, perfil del propietario, reseñas y cálculo dinámico del coste                          | Hecho                                                |
| Cuenta RentSafe (registro, inicio de sesión, perfil) separada de la billetera                                                                           | Hecho (local, ver límites)                           |
| Arrendatario: solicitar, depositar, confirmar entrega, pedir el depósito, disputar, historial y referencias                                             | Hecho                                                |
| Propietario: panel con cifras derivadas de las reservas, solicitudes, aceptar/rechazar, publicar/editar con fotos, pausar, cobrar, registrar devolución | Hecho                                                |
| Escrow Trustless Work multi-release (2 hitos) integrado en el flujo                                                                                     | Implementado, **no probado contra testnet** (ver §6) |
| Contrato Soroban `rental_registry` + 8 tests                                                                                                            | Escrito, **no compilado aquí** (ver §6)              |
| Cavos (correo/Google) y extensiones (Freighter) vía `useWallet()`                                                                                       | Cableado del scaffold, con UI en español             |
| Modo simulación claramente etiquetado (refs `SIM-…`)                                                                                                    | Hecho y probado de punta a punta                     |

## 2. Arquitectura

```
app/src/rentsafe/
  types.ts            Modelos: Listing, Owner, Booking, BookingStatus, TxRecord…
  categories.ts       Categorías, unidades de cobro, etiquetas de atributos
  config.ts           Parámetros de demostración (comisión, moneda, owner demo)
  pricing.ts          Cotización, disponibilidad, "Destacado" (derivado de datos)
  search.ts           Filtros ↔ URL y aplicación de filtros
  bookingStatus.ts    Etiquetas de estados/modos, línea de tiempo, ingresos derivados
  data/seed.ts        Datos de demostración (20 bienes, 6 propietarios, 10 reservas)
  store/              Persistencia (localStorage tras una API de store sustituible)
  chain/registry.ts   Cliente del contrato rental_registry (degrada si no existe)
  chain/useBookingFlow.ts   Orquestador de transiciones: escrow + registro + simulación
  chain/readiness.ts  Requisitos del modo on-chain
  components/, pages/, styles/
contracts/rental-registry/  Contrato Soroban (Rust) + tests
```

Toda firma pasa por `useWallet().signTransaction` (Cavos o extensión). Las
escrituras del escrow pasan por `useEscrowTx().run()` del scaffold.

### Qué va on-chain y qué no

| Dato                                                                                             | Dónde                                           | Por qué                        |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------ |
| Alquiler + depósito (USDC) y quién puede moverlos                                                | Escrow Trustless Work (un contrato por reserva) | Reglas de dinero verificables  |
| Acuerdo: bien, billeteras, fechas, importes, estado; anti-solapes y anti-reutilización de escrow | `rental_registry` (Soroban)                     | Registro público e inalterable |
| Fotos, descripciones, perfiles, búsqueda                                                         | Fuera de cadena (localStorage en el MVP)        | Tamaño, privacidad, editable   |
| Nombre, correo, ciudad                                                                           | Fuera de cadena, nunca on-chain                 | Datos personales               |

### Diseño del escrow (multi-release)

| Rol Trustless Work                    | Quién                                                      | Para qué                                                    |
| ------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Hito 0 "Alquiler"                     | receptor = propietario                                     | Se paga al propietario                                      |
| Hito 1 "Depósito de garantía"         | receptor = arrendatario                                    | Reembolso                                                   |
| `approver`                            | arrendatario                                               | Confirma la entrega (hito 0) y acepta el reembolso (hito 1) |
| `serviceProvider`                     | propietario                                                | Registra la devolución con evidencia (hito 1)               |
| `releaseSigner`                       | propietario                                                | Libera cada hito aprobado                                   |
| `disputeResolver` / `platformAddress` | `PUBLIC_PLATFORM_ADDRESS` (o el arrendatario en modo demo) | Reparte el depósito en disputa                              |

Consecuencias: el propietario no cobra sin la aprobación del arrendatario; el
depósito no vuelve sin aprobación del arrendatario **y** liberación del
propietario; cualquiera puede bloquear el depósito con una disputa. `platformFee`
es 0 para no descontar comisión del reembolso del depósito; Trustless Work
descuenta 0,3% de cada liberación.

### Ciclo de vida de una reserva

```
requested ─accept→ accepted ─fund→ funded ─confirmReceipt→ active ─registerReturn→ return_review ─releaseDeposit→ completed
    │ reject/cancel     │ cancel                    (releaseRent cuando el hito 0 está aprobado)
    ▼                   ▼                     active/return_review ─dispute→ disputed ─resolve→ resolved
 rejected           cancelled
```

Firmas en modo on-chain:

1. Solicitar: `rental_registry.request` (arrendatario).
2. Aceptar/rechazar: `accept` / `reject` (propietario; el contrato rechaza fechas solapadas).
3. Depositar: crear escrow (TW) → `link_escrow` (registro) → `fundEscrow` (TW). El dinero se mueve al final.
4. Confirmar entrega: `approveMilestone(0)` (arrendatario). Cobrar: `releaseFunds(0)` (propietario).
5. Devolución: `changeMilestoneStatus(1, "devuelto", notas)` (propietario), `approveMilestone(1)` (arrendatario), `releaseFunds(1)` (propietario) → `complete` (registro).
6. Disputa: `startDispute(1)` + `open_dispute`; resolución: `resolveDispute(1, reparto)` (árbitro).

Ninguna operación se marca "Confirmada" antes de que la API/el contrato
respondan con éxito; los fallos quedan en el historial con su error.

## 3. Instalar y ejecutar

Requisitos: Node 22+, Rust (rustup), git. En Windows, WSL2.

```bash
npm run setup:tools        # Stellar CLI + plugin de Scaffold
npm install
npm run doctor             # crea app/.env y revisa todo
npm run contracts:build    # compila, despliega en testnet y genera clientes (incluye rental_registry)
npm run check              # tests de contratos, formato, tipos y lint
npm start                  # http://localhost:5173
```

## 4. Variables de entorno (`app/.env`, todas públicas por diseño)

| Variable                        | Para qué                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_TRUSTLESS_WORK_API_KEY` | **Necesaria para el modo on-chain.** dapp.trustlesswork.com → perfil → API Keys → Testnet                         |
| `PUBLIC_CAVOS_APP_ID`           | Inicio de sesión con correo/Google. cavos.xyz/dashboard; agrega `http://localhost:5173` a los orígenes permitidos |
| `PUBLIC_PLATFORM_ADDRESS`       | Billetera del árbitro de disputas. Vacío = modo demo (el arrendatario hace de árbitro, se avisa en la UI)         |
| `PUBLIC_DEMO_OWNER_ADDRESS`     | Opcional: billetera que cobra los bienes de demostración, para probar el flujo real sobre ellos                   |
| `PUBLIC_RENTSAFE_FEE_PERCENT`   | Comisión de demostración al arrendatario (por defecto 0)                                                          |

Nunca pongas claves secretas (`S…`), frases semilla ni la API key de operador de Cavos (`cav_…`).

## 5. Probar el flujo real en testnet (dos billeteras, un navegador)

1. Configura `PUBLIC_TRUSTLESS_WORK_API_KEY`, `PUBLIC_CAVOS_APP_ID` y
   `PUBLIC_DEMO_OWNER_ADDRESS` = tu dirección de Freighter (testnet). Reinicia `npm start`.
2. Crea tu cuenta RentSafe en `/entrar`.
3. Conecta Cavos ("Con correo o Google"). En **Perfil y billetera**: activar con
   Friendbot → habilitar USDC → cambiar 500 XLM por USDC.
4. En Freighter (la billetera propietaria): fondéala con Friendbot y agrega la
   trustline de USDC (necesaria para recibir).
5. Elige un bien de demostración (p. ej. "Consola de videojuegos"), solicita en
   modo **On-chain** y firma `request`.
6. Cambia a Freighter (Desconectar → "Con Freighter u otra extensión"), abre la
   reserva y **Acepta**.
7. Vuelve a Cavos: **Depositar en garantía** (3 firmas) → **Confirmar que recibí el bien**.
8. Freighter: **Cobrar el alquiler** → **Registrar devolución**.
9. Cavos: **Solicitar devolución del depósito**. Freighter: **Devolver depósito**.
10. Cada paso deja un enlace a stellar.expert y el escrow se ve en el visor de Trustless Work.

## 6. Estado y limitaciones (honesto)

- **Entorno de desarrollo sin red**: este proyecto se construyó en un entorno
  sin acceso al registro de npm, crates.io, Stellar testnet ni a la API de
  Trustless Work. Por eso **no se ejecutó** `npm install`, `npm run check`,
  `cargo test`, ni ningún despliegue o transacción real. El contrato
  `rental_registry` **no está desplegado**.
- **Lo que sí se verificó**: build de la UI con esbuild (con stubs de las SDKs
  no instalables), chequeo TypeScript estricto del código de RentSafe con tipos
  stub, `rustfmt` del contrato, formato Prettier con la convención del repo, y
  una prueba de navegador (Playwright) que recorre búsqueda, filtros, registro,
  solicitud, las 7 transiciones del alquiler en simulación, resolución de
  disputa, publicación con validación y vistas móviles sin desbordes ni errores
  de consola.
- **Primer paso pendiente** en una máquina con red: `npm install && npm run
contracts:build && npm run check`. Si `cargo test -p rental-registry` o el
  typecheck contra las SDKs reales muestran errores, son ajustes de tipos
  puntuales (payloads de Trustless Work, cliente generado).
- Persistencia local (localStorage): cuentas, publicaciones y reservas viven en
  un navegador. Sustituir `store/store.ts` por un backend (Supabase, API) para
  multiusuario real. La cuenta no tiene contraseña.
- Resolver una disputa en el registro on-chain (`resolve_dispute`) requiere al
  admin (`me`, CLI): `stellar contract invoke --id rental_registry --source me --network testnet -- resolve_dispute --id <n>`.
  El reparto de fondos sí se hace desde la UI en el escrow.
- Si el bien nunca se entrega, el alquiler queda retenido (el propietario no
  puede cobrarlo), pero la disputa sobre el hito de alquiler aún no está en la UI.
- Las fotos de demostración se cargan de Unsplash; si no cargan, se muestra un
  marcador de la marca.
- Las reseñas de demostración están etiquetadas; publicar reseñas tras un
  alquiler (contrato `reputation` del scaffold) es el siguiente paso natural.
