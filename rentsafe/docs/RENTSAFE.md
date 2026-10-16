# RentSafe: guía técnica

Marketplace de alquiler entre personas y empresas (alojamiento, vehículos,
tecnología y equipo de trabajo) donde el alquiler y el depósito de garantía
esperan en un escrow en Stellar hasta que ambas partes cumplen.

Construido sobre `scaffold-stellar-agentic` (Scaffold Stellar + Trustless Work +
Cavos). Todo funciona en **Stellar testnet**.

## 1. Qué hay implementado

| Área                                                                                                                                                    | Estado                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Inicio con buscador, destacados, populares, alquilados recientemente, cómo funciona, protección del depósito, CTA a propietarios, footer                | Hecho                                                                                |
| Cuatro categorías con vista propia y filtros específicos por categoría                                                                                  | Hecho                                                                                |
| Buscador y filtros (ubicación, fechas, categoría, precio, disponibilidad, orden y atributos) que filtran de verdad y viven en la URL                    | Hecho                                                                                |
| Detalle con galería, características, requisitos, disponibilidad, perfil del propietario, reseñas y cálculo dinámico del coste                          | Hecho                                                                                |
| Cuenta RentSafe (registro, inicio de sesión, perfil) separada de la billetera                                                                           | Hecho (local, ver §6)                                                                |
| Arrendatario: solicitar, depositar, confirmar entrega, pedir el depósito, disputar (daños o bien no entregado), historial y reseñas                     | Hecho                                                                                |
| Propietario: panel con cifras derivadas de las reservas, solicitudes, aceptar/rechazar, publicar/editar con fotos, pausar, cobrar, registrar devolución | Hecho                                                                                |
| Árbitro de la plataforma: página `/arbitro` con las disputas de su billetera                                                                            | Hecho                                                                                |
| Escrow Trustless Work multi-release (alquiler, depósito y comisión como hitos)                                                                          | Implementado; flujo completo pendiente de probar en testnet (§5)                     |
| Contrato Soroban `rental_registry`: acuerdo, anti-solapes, verificación del escrow, índice por billetera, reseñas verificadas + 13 tests                | Tests pasan; desplegado en testnet (la versión nueva se redespliega con `npm start`) |
| Sincronización de reservas on-chain entre navegadores (`useChainSync`)                                                                                  | Hecho                                                                                |
| Cavos (correo/Google) y extensiones (Freighter) vía `useWallet()`                                                                                       | Cableado del scaffold, con UI en español                                             |
| Modo simulación claramente etiquetado (refs `SIM-…`)                                                                                                    | Hecho y probado de punta a punta                                                     |

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
  chain/registry.ts   Cliente del contrato rental_registry (escrituras y lecturas)
  chain/milestones.ts Orden e importes de los hitos del escrow
  chain/useBookingFlow.ts   Orquestador de transiciones: escrow + registro + simulación
  chain/useChainSync.ts     Lee las reservas on-chain de la billetera y las importa/actualiza
  chain/readiness.ts  Requisitos del modo on-chain
  components/, pages/, styles/
contracts/rental-registry/  Contrato Soroban (Rust) + tests
```

Toda firma pasa por `useWallet().signTransaction` (Cavos o extensión). Las
escrituras del escrow pasan por `useEscrowTx().run()` del scaffold.

**Regla de orden:** primero la cadena, después la copia local. La copia local
solo cambia cuando cada paso on-chain respondió con éxito, y las acciones de
varios pasos recuerdan qué pasos ya se firmaron: reintentar nunca repite una
firma. Si el registro falla después de liberar fondos, la reserva ofrece "Cerrar
la reserva on-chain" para reintentarlo.

### Qué va on-chain y qué no

| Dato                                                                                                  | Dónde                                           | Por qué                        |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| Alquiler + depósito + comisión (USDC) y quién puede moverlos                                          | Escrow Trustless Work (un contrato por reserva) | Reglas de dinero verificables  |
| Acuerdo: bien, billeteras, fechas, importes, estado, árbitro; anti-solapes; escrow verificado y único | `rental_registry` (Soroban)                     | Registro público e inalterable |
| Reseñas entre las partes de una reserva cerrada                                                       | `rental_registry` (Soroban)                     | Reputación no falsificable     |
| Fotos, descripciones, perfiles, búsqueda                                                              | Fuera de cadena (localStorage en el MVP)        | Tamaño, privacidad, editable   |
| Nombre, correo, ciudad                                                                                | Fuera de cadena, nunca on-chain                 | Datos personales               |

### Diseño del escrow (multi-release)

| Rol / hito Trustless Work             | Quién                     | Para qué                                                        |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| Hito 0 "Alquiler"                     | receptor = propietario    | Se paga al propietario                                          |
| Hito 1 "Depósito de garantía"         | receptor = arrendatario   | Reembolso (solo si hay depósito)                                |
| Hito "Comisión RentSafe"              | receptor = plataforma     | Comisión (solo si `PUBLIC_RENTSAFE_FEE_PERCENT` > 0)            |
| `approver`                            | arrendatario              | Confirma la entrega (alquiler + comisión) y acepta el reembolso |
| `serviceProvider`                     | propietario               | Registra la devolución con evidencia                            |
| `releaseSigner`                       | propietario               | Libera cada hito aprobado                                       |
| `disputeResolver` / `platformAddress` | `PUBLIC_PLATFORM_ADDRESS` | Reparte los fondos en disputa (nunca una de las partes)         |

`platformFee` (porcentaje) es 0: la comisión es un hito propio, así nunca se
descuenta del reembolso del depósito. Trustless Work descuenta 0,3% de cada
liberación.

**Verificación on-chain del escrow.** `rental_registry.link_escrow` llama a
`get_escrow` del escrow y comprueba: aprobador = arrendatario, proveedor y
liberador = propietario, árbitro y plataforma distintos de las partes,
`platform_fee = 0`, activo = USDC configurado en el registro, y que los hitos
coinciden exactamente (importes y receptores) con la reserva. Si algo no
coincide, el vínculo se rechaza antes de mover dinero. La lectura usa los
nombres de campo del escrow V1 multi-release de Trustless Work
(`multi-release-main`); si Trustless Work cambia ese formato, el vínculo fallará
con "No se pudo leer el escrow" y habrá que actualizar `verify_escrow`.

### Ciclo de vida de una reserva

```
requested ─accept→ accepted ─fund→ funded ─confirmReceipt→ active ─registerReturn→ return_review ─releaseDeposit→ completed
    │ reject/cancel     │ cancel        │                       (releaseRent cuando el alquiler está aprobado)
    ▼                   ▼               └─disputeDelivery→ disputed ─resolve→ resolved
 rejected           cancelled          active/return_review ─dispute→ disputed ─resolve→ resolved
```

Firmas en modo on-chain:

1. Solicitar: `rental_registry.request` (arrendatario).
2. Aceptar/rechazar: `accept` / `reject` (propietario; el contrato rechaza
   fechas solapadas).
3. Depositar: crear escrow (TW) → `link_escrow` (registro, verifica el escrow) →
   `fundEscrow` (TW). El dinero se mueve al final.
4. Entrega: `changeMilestoneStatus(alquiler [+ comisión], "entregado")`
   (propietario). Confirmar entrega: `approveMilestone` del alquiler (+
   comisión) (arrendatario). Cobrar: `releaseFunds` del alquiler (+ comisión)
   (propietario). El contrato de Trustless Work no deja aprobar un hito con el
   estado vacío (la API lo crea como `"pending"`); el paso de entrega deja
   constancia on-chain de que el propietario dice haber entregado.
5. Devolución: `changeMilestoneStatus(depósito, "devuelto", notas)`
   (propietario), `approveMilestone(depósito)` (arrendatario),
   `releaseFunds(depósito)` (propietario) → `complete` (registro).
6. Disputa por daños: `startDispute(depósito)` + `open_dispute`. Bien no
   entregado (antes de confirmar la entrega): `startDispute` de alquiler,
   depósito y comisión + `open_dispute`.
7. Resolución (árbitro): `resolveDispute` de cada hito en disputa (el principal
   se reparte; en "no entregado" el depósito y la comisión vuelven al
   arrendatario) → `resolve_dispute` (registro, firmado por el árbitro del
   escrow o el admin).
8. Reseña: `review` (cada parte, una vez, con la reserva completada o resuelta).

Ninguna operación se marca "Confirmada" antes de que la API/el contrato
respondan con éxito; los fallos quedan en el historial con su error.

### Sincronización entre navegadores

Cada 30 s (y al conectar la billetera) `useChainSync` lee
`bookings_of(billetera)` + `get_booking` del registro y el estado de cada escrow
en el indexador de Trustless Work. Importa las reservas que el navegador no
conocía y solo mueve las conocidas hacia delante (los hitos liberados o
aprobados no se deshacen, y el indexador puede tardar unos segundos). El
registro indexa cada reserva bajo el arrendatario y el propietario al
solicitarla, y bajo el árbitro al vincular el escrow.

## 3. Instalar y ejecutar

Requisitos: Node 22+, Rust (rustup), git. En Windows, WSL2.

```bash
npm run setup:tools        # Stellar CLI + plugin de Scaffold
npm install
npm run doctor             # crea app/.env y revisa todo
npm run contracts:build    # compila, despliega en testnet y genera clientes (incluye rental_registry)
npm run check              # tests de contratos, formato, tipos y lint
npm run contracts:e2e      # registro + escrow real de Trustless Work (descarga su código)
npm start                  # http://localhost:5173
```

## 4. Variables de entorno (`app/.env`, todas públicas por diseño)

| Variable                        | Para qué                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_TRUSTLESS_WORK_API_KEY` | **Necesaria para el modo on-chain.** dapp.trustlesswork.com → perfil → API Keys → Testnet                                                     |
| `PUBLIC_PLATFORM_ADDRESS`       | **Necesaria para el modo on-chain.** Billetera del árbitro (y receptora de la comisión). Debe ser distinta del arrendatario y del propietario |
| `PUBLIC_CAVOS_APP_ID`           | Inicio de sesión con correo/Google. cavos.xyz/dashboard; agrega `http://localhost:5173` a los orígenes permitidos                             |
| `PUBLIC_DEMO_OWNER_ADDRESS`     | Opcional: billetera que cobra los bienes de demostración, para probar el flujo real sobre ellos                                               |
| `PUBLIC_RENTSAFE_FEE_PERCENT`   | Comisión de demostración al arrendatario (por defecto 0). Se cobra como hito del escrow para la plataforma                                    |

Nunca pongas claves secretas (`S…`), frases semilla ni la API key de operador de
Cavos (`cav_…`).

El activo que aceptan los escrows se fija al desplegar `rental_registry`
(`--token` en `environments.toml`): USDC de testnet,
`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

## 5. Probar el flujo real en testnet (tres billeteras)

Se necesitan tres billeteras porque el contrato no acepta que una parte sea
árbitro: arrendatario (Cavos), propietario (Freighter, cuenta 1) y árbitro
(Freighter, cuenta 2).

1. Configura en `app/.env`: `PUBLIC_TRUSTLESS_WORK_API_KEY`,
   `PUBLIC_CAVOS_APP_ID`, `PUBLIC_DEMO_OWNER_ADDRESS` = Freighter cuenta 1 y
   `PUBLIC_PLATFORM_ADDRESS` = Freighter cuenta 2. Reinicia `npm start`
   (redespliega `rental_registry`).
2. Crea tu cuenta RentSafe en `/entrar`.
3. Conecta Cavos ("Con correo o Google"). En **Perfil y billetera**: activar con
   Friendbot → habilitar USDC → cambiar 500 XLM por USDC.
4. En Freighter, fondea ambas cuentas con Friendbot y agrega la trustline de
   USDC (necesaria para recibir).
5. Elige un bien de demostración (p. ej. "Consola de videojuegos"), solicita en
   modo **On-chain** y firma `request`.
6. Cambia a Freighter cuenta 1 (Desconectar → "Con Freighter u otra extensión"):
   la reserva aparece sola en el panel de propietario (sincronizada desde la
   cadena; también funciona desde otro navegador). **Acepta**.
7. Vuelve a Cavos: **Depositar en garantía** (3 firmas).
8. Freighter cuenta 1: **Marcar como entregado**. Cavos: **Confirmar que recibí
   el bien**. Freighter cuenta 1: **Cobrar el alquiler** → **Registrar
   devolución**.
9. Cavos: **Solicitar devolución del depósito**. Freighter cuenta 1: **Devolver
   depósito**.
10. Ambas partes: **Publicar reseña on-chain**. La puntuación aparece en la
    ficha del bien.
11. Disputa: repite con otra reserva, abre una disputa y conecta Freighter
    cuenta 2: en el menú aparece **Disputas (árbitro)**.
12. Cada paso deja un enlace a stellar.expert y el escrow se ve en el visor de
    Trustless Work.

## 6. Estado y limitaciones (honesto)

- **Verificado:**
  - `cargo test`: 13 tests de `rental_registry`.
  - `npm run contracts:e2e`: 4 tests de integración contra el **contrato real de
    Trustless Work** (multi-release V1, commit fijado), en el mismo entorno
    Soroban: flujo completo con dinero, disputa por bien no entregado con
    reparto, rechazo de escrows incorrectos, y que aprobar sin estado falla. El
    script descarga el contrato de Trustless Work al ejecutarse (no se incluye
    en el repo porque no tiene licencia).
  - `cargo clippy`, `cargo fmt`, typecheck (`tsc -b`), ESLint, Prettier,
    `vite build`, y una prueba de navegador (Playwright) del flujo completo en
    simulación.
- **Probado en testnet (16-oct-2026)** desde la app, con billeteras de prueba y
  la API real de Trustless Work: flujo completo (solicitud → aceptación → escrow
  creado por la API y verificado por `link_escrow` → depósito → entrega → cobro
  de alquiler y comisión → devolución → depósito → cierre → reseñas) y disputa
  por bien no entregado resuelta por el árbitro. Los saldos cuadran (0,3% de
  Trustless Work por liberación). Falta solo la prueba con la interfaz de las
  billeteras (Cavos y Freighter).
- Al cambiar el contrato, `npm start` lo redespliega con un id nuevo: las
  reservas on-chain anteriores quedan en el contrato viejo. La clave de
  localStorage pasó a `rentsafe:v2` para empezar limpio.
- `CAVOS_APP_SALT` ahora es `"rentsafe"`: las billeteras Cavos de testnet
  creadas antes son otras billeteras. No vuelvas a cambiarlo con usuarios
  reales.
- **Publicaciones, fotos y perfiles siguen en localStorage.** Las reservas
  on-chain se comparten entre navegadores a través de la cadena, pero una
  publicación creada en un navegador no aparece en otro. Para multiusuario real
  hay que sustituir `store/store.ts` por un backend (Supabase, API). La cuenta
  RentSafe no tiene contraseña.
- Las reseñas de demostración de los bienes semilla están etiquetadas; las
  reseñas verificadas on-chain se muestran aparte.
- Las fotos de demostración se cargan de Unsplash; si no cargan, se muestra un
  marcador de la marca.
