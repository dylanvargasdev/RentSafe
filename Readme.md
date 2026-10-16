# RentSafe

Plataforma basada en blockchain para gestionar alquileres, depósitos de garantía y pagos de forma segura y transparente, conectando propietarios e inquilinos.

## Objetivo del proyecto

RentSafe busca facilitar los alquileres entre propietarios e inquilinos mediante una plataforma que utiliza tecnología blockchain para aportar transparencia y seguridad en cada una de sus operaciones.

## Funcionalidades principales
- Gestión de solicitudes de alquiler.
- Administración de depósitos de garantía.
- Registro de operaciones relacionadas con los alquileres.
- Apoyo a la gestión de devoluciones y posibles disputas.

## Tecnologías del proyecto
RentSafe utiliza tecnologías del ecosistema Stellar y contratos inteligentes Soroban para explorar la gestión transparente de operaciones de alquiler.

## Estado del proyecto
El proyecto se encuentra en desarrollo. Las funcionalidades y las integraciones se validarán progresivamente durante la implementación y las pruebas en la red de pruebas de Stellar.

---

## Verificación rápida para el jurado (TicoChallenge)

| Entregable | Dónde verlo |
|---|---|
| Repositorio creado con **Scaffold Stellar** | Código en [`rentsafe/`](rentsafe/): contratos en `contracts/`, `environments.toml`, clientes TypeScript generados por Scaffold, app en `app/` |
| **Contrato desplegado en Testnet** | `rental_registry`: [`CBVYTPTWBERGUWRVS4CGRFEXDLH6437XQFRT76UAHEE2OTYLW5I4GLUN`](https://stellar.expert/explorer/testnet/contract/CBVYTPTWBERGUWRVS4CGRFEXDLH6437XQFRT76UAHEE2OTYLW5I4GLUN) |
| **Frontend conectado al contrato** | `rentsafe/app/src/rentsafe/chain/` (`registry.ts`, `useBookingFlow.ts`, `useChainSync.ts`): cada paso de la reserva firma una transacción contra el contrato |
| Escrow real de Trustless Work (ejemplo) | [Visor del escrow `CD2QP7…IXHK`](https://viewer.trustlesswork.com/testnet/v1/CD2QP7WPYUOKBZ7TEEN3NSKUEIP5KVXM3LHMV6H6DNWGS5S7SMAMIXHK) · [solicitud on-chain](https://stellar.expert/explorer/testnet/tx/0a7ac3b390d0a43caf3e581fade7f706097c6f0dcb56f051385ceb14330868ef) · [escrow verificado y vinculado](https://stellar.expert/explorer/testnet/tx/bd2df4d087d0bf9eaad4314f790c4accb1f13b30819889327fa8141757315465) |

## Cómo usa Stellar

- **Escrow de Trustless Work (USDC):** el alquiler, el depósito de garantía y la comisión esperan en un contrato por reserva. El propietario cobra cuando el arrendatario confirma la entrega; el depósito vuelve tras la devolución; si hay disputa, decide un árbitro independiente.
- **Contrato Soroban propio, `rental_registry`:** registra cada acuerdo (bien, fechas, importes, partes), impide reservas solapadas y, al vincular el escrow, **lo lee on-chain y verifica** roles, importes, receptores y moneda antes de que se mueva dinero. También guarda reseñas que solo pueden dejar las partes de una reserva cerrada.
- **Cavos:** billetera Stellar con correo o Google, sin extensiones. También funciona con Freighter.

## Problema y usuario

Alquilar entre personas (alojamiento, vehículos, tecnología, equipo de trabajo) exige confiar a ciegas: el arrendatario adelanta un depósito que muchas veces no vuelve, y el propietario no tiene garantía de cobro ni de que el bien regrese en buen estado. RentSafe deja el dinero en garantía en Stellar con reglas que ninguna de las partes puede saltarse sola.

## Ejecutar el proyecto

Requisitos: Node 22+, Rust (rustup), Stellar CLI. Guía completa en [`rentsafe/docs/RENTSAFE.md`](rentsafe/docs/RENTSAFE.md).

```bash
cd rentsafe
npm run setup:tools && npm install
npm run doctor              # crea app/.env (completa las claves de testnet)
npm run contracts:build     # compila y despliega rental_registry en testnet
npm start                   # http://localhost:5173
```

En PowerShell usa `npm.cmd` en lugar de `npm`.

## Pruebas

```bash
cd rentsafe
npm run check               # tests de contratos, formato, tipos y lint
npm run contracts:e2e       # rental_registry + escrow real de Trustless Work
```

- 13 tests unitarios del contrato y 4 de integración contra el contrato real de Trustless Work.
- Flujo completo y disputa ejecutados en Stellar testnet (ver enlaces arriba).

## Equipo

- Dylan Vargas ([@dylanvargasdev](https://github.com/dylanvargasdev))
- Adonai ([@AdonaiLogic](https://github.com/AdonaiLogic))
