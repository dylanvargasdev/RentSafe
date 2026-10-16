import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBVYTPTWBERGUWRVS4CGRFEXDLH6437XQFRT76UAHEE2OTYLW5I4GLUN",
  }
} as const

export const Errors = {
  /**
   * No existe una reserva con ese identificador.
   */
  1: {message:"NotFound"},
  /**
   * No tienes permiso para realizar esta acción sobre la reserva.
   */
  2: {message:"Unauthorized"},
  /**
   * La reserva no está en un estado que permita esta acción.
   */
  3: {message:"InvalidState"},
  /**
   * La fecha de finalización debe ser posterior a la de inicio.
   */
  4: {message:"InvalidPeriod"},
  /**
   * El alquiler debe ser mayor que cero; el depósito y la comisión no pueden ser negativos.
   */
  5: {message:"InvalidAmount"},
  /**
   * No puedes alquilar un bien que publicaste tú.
   */
  6: {message:"SelfRental"},
  /**
   * El identificador de la publicación es demasiado largo o está vacío.
   */
  7: {message:"InvalidListing"},
  /**
   * Las fechas se solapan con otra reserva ya aceptada para este bien.
   */
  8: {message:"Overlap"},
  /**
   * Este escrow ya está vinculado a otra reserva.
   */
  9: {message:"EscrowAlreadyUsed"},
  /**
   * Este bien tiene demasiadas reservas activas.
   */
  10: {message:"TooManyActive"},
  /**
   * No se pudo leer el escrow o no tiene el formato de Trustless Work.
   */
  11: {message:"EscrowUnreadable"},
  /**
   * Los roles del escrow no coinciden con la reserva (o una parte es árbitro o plataforma).
   */
  12: {message:"EscrowRolesMismatch"},
  /**
   * Los hitos del escrow (importes o receptores) no coinciden con la reserva.
   */
  13: {message:"EscrowMilestonesMismatch"},
  /**
   * El escrow no usa la moneda de la plataforma o cobra una comisión no permitida.
   */
  14: {message:"EscrowAssetMismatch"},
  /**
   * La calificación debe estar entre 1 y 5.
   */
  15: {message:"InvalidRating"},
  /**
   * El comentario supera los 280 bytes.
   */
  16: {message:"CommentTooLong"},
  /**
   * Ya dejaste una reseña para esta reserva.
   */
  17: {message:"AlreadyReviewed"}
}


export interface Score {
  /**
 * Reseñas recibidas.
 */
count: u32;
  /**
 * Suma de calificaciones. Media = total / count.
 */
total: u32;
}


export interface Review {
  booking_id: u32;
  comment: string;
  /**
 * 1 a 5 estrellas.
 */
rating: u32;
  reviewer: string;
  subject: string;
  timestamp: u64;
}

export type Status = {tag: "Requested", values: void} | {tag: "Accepted", values: void} | {tag: "Rejected", values: void} | {tag: "Cancelled", values: void} | {tag: "EscrowLinked", values: void} | {tag: "Completed", values: void} | {tag: "Disputed", values: void} | {tag: "Resolved", values: void};


export interface Booking {
  /**
 * Árbitro de disputas, leído del escrow al vincularlo.
 */
arbiter: Option<string>;
  created_at: u64;
  deposit: i128;
  end: u64;
  /**
 * Escrow de Trustless Work que custodia los fondos (`C...`).
 */
escrow: Option<string>;
  /**
 * Comisión de la plataforma (hito propio del escrow, receptor = plataforma).
 */
fee: i128;
  id: u32;
  listing_id: string;
  owner: string;
  /**
 * Importes con 7 decimales (1 USDC = 10_000_000).
 */
rent: i128;
  /**
 * Inicio y fin del alquiler (unix, segundos).
 */
start: u64;
  status: Status;
  tenant: string;
  updated_at: u64;
}



export interface Client {
  /**
   * Construct and simulate a count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a accept transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * El propietario acepta. Bloquea las fechas para ese bien.
   */
  accept: ({owner, id}: {owner: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cualquiera de las partes cancela ANTES de que exista un escrow con fondos.
   */
  cancel: ({caller, id}: {caller: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reject transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * El propietario rechaza una solicitud pendiente.
   */
  reject: ({owner, id}: {owner: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Una parte reseña a la otra tras una reserva cerrada (completada o con
   * disputa resuelta). Una reseña por parte y reserva.
   */
  review: ({reviewer, id, rating, comment}: {reviewer: string, id: u32, rating: u32, comment: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a request transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * El arrendatario solicita alquilar `listing_id` del `owner` en un período.
   */
  request: ({tenant, owner, listing_id, start, end, rent, deposit, fee}: {tenant: string, owner: string, listing_id: string, start: u64, end: u64, rent: i128, deposit: i128, fee: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Actualiza el código del contrato (solo el administrador).
   */
  upgrade: ({wasm_hash}: {wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a complete transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * El propietario cierra la reserva cuando el escrow ya liberó los fondos.
   */
  complete: ({owner, id}: {owner: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a score_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Puntuación acumulada de una billetera.
   */
  score_of: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Score>>

  /**
   * Construct and simulate a get_review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_review: ({id, reviewer}: {id: u32, reviewer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Review>>>

  /**
   * Construct and simulate a reviews_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Últimas reseñas recibidas por una billetera (la más antigua primero).
   */
  reviews_of: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Review>>>

  /**
   * Construct and simulate a bookings_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Ids de las reservas (recientes) de una billetera: como arrendatario,
   * propietario o árbitro (desde que se vincula el escrow).
   */
  bookings_of: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a get_booking transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_booking: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Booking>>>

  /**
   * Construct and simulate a link_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * El arrendatario vincula el escrow que custodia el alquiler y el depósito.
   * El contrato lee el escrow y comprueba que corresponde a esta reserva.
   * Un escrow solo puede vincularse una vez y a una sola reserva.
   */
  link_escrow: ({tenant, id, escrow}: {tenant: string, id: u32, escrow: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a open_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cualquiera de las partes abre una disputa sobre una reserva con escrow.
   */
  open_dispute: ({caller, id}: {caller: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a active_bookings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Ids de reservas aceptadas y abiertas de una publicación.
   */
  active_bookings: ({listing_id}: {listing_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * El árbitro del escrow (o el administrador) marca la disputa como
   * resuelta. El reparto de fondos se ejecuta en el escrow.
   */
  resolve_dispute: ({caller, id}: {caller: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a booking_of_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reserva vinculada a un escrow, si existe.
   */
  booking_of_escrow: ({escrow}: {escrow: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, token}: {admin: string, token: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAEQAAACxObyBleGlzdGUgdW5hIHJlc2VydmEgY29uIGVzZSBpZGVudGlmaWNhZG9yLgAAAAhOb3RGb3VuZAAAAAEAAAA+Tm8gdGllbmVzIHBlcm1pc28gcGFyYSByZWFsaXphciBlc3RhIGFjY2nDs24gc29icmUgbGEgcmVzZXJ2YS4AAAAAAAxVbmF1dGhvcml6ZWQAAAACAAAAOkxhIHJlc2VydmEgbm8gZXN0w6EgZW4gdW4gZXN0YWRvIHF1ZSBwZXJtaXRhIGVzdGEgYWNjacOzbi4AAAAAAAxJbnZhbGlkU3RhdGUAAAADAAAAPExhIGZlY2hhIGRlIGZpbmFsaXphY2nDs24gZGViZSBzZXIgcG9zdGVyaW9yIGEgbGEgZGUgaW5pY2lvLgAAAA1JbnZhbGlkUGVyaW9kAAAAAAAABAAAAFlFbCBhbHF1aWxlciBkZWJlIHNlciBtYXlvciBxdWUgY2VybzsgZWwgZGVww7NzaXRvIHkgbGEgY29taXNpw7NuIG5vIHB1ZWRlbiBzZXIgbmVnYXRpdm9zLgAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABQAAAC5ObyBwdWVkZXMgYWxxdWlsYXIgdW4gYmllbiBxdWUgcHVibGljYXN0ZSB0w7ouAAAAAAAKU2VsZlJlbnRhbAAAAAAABgAAAEZFbCBpZGVudGlmaWNhZG9yIGRlIGxhIHB1YmxpY2FjacOzbiBlcyBkZW1hc2lhZG8gbGFyZ28gbyBlc3TDoSB2YWPDrW8uAAAAAAAOSW52YWxpZExpc3RpbmcAAAAAAAcAAABCTGFzIGZlY2hhcyBzZSBzb2xhcGFuIGNvbiBvdHJhIHJlc2VydmEgeWEgYWNlcHRhZGEgcGFyYSBlc3RlIGJpZW4uAAAAAAAHT3ZlcmxhcAAAAAAIAAAALkVzdGUgZXNjcm93IHlhIGVzdMOhIHZpbmN1bGFkbyBhIG90cmEgcmVzZXJ2YS4AAAAAABFFc2Nyb3dBbHJlYWR5VXNlZAAAAAAAAAkAAAAsRXN0ZSBiaWVuIHRpZW5lIGRlbWFzaWFkYXMgcmVzZXJ2YXMgYWN0aXZhcy4AAAANVG9vTWFueUFjdGl2ZQAAAAAAAAoAAABCTm8gc2UgcHVkbyBsZWVyIGVsIGVzY3JvdyBvIG5vIHRpZW5lIGVsIGZvcm1hdG8gZGUgVHJ1c3RsZXNzIFdvcmsuAAAAAAAQRXNjcm93VW5yZWFkYWJsZQAAAAsAAABYTG9zIHJvbGVzIGRlbCBlc2Nyb3cgbm8gY29pbmNpZGVuIGNvbiBsYSByZXNlcnZhIChvIHVuYSBwYXJ0ZSBlcyDDoXJiaXRybyBvIHBsYXRhZm9ybWEpLgAAABNFc2Nyb3dSb2xlc01pc21hdGNoAAAAAAwAAABJTG9zIGhpdG9zIGRlbCBlc2Nyb3cgKGltcG9ydGVzIG8gcmVjZXB0b3Jlcykgbm8gY29pbmNpZGVuIGNvbiBsYSByZXNlcnZhLgAAAAAAABhFc2Nyb3dNaWxlc3RvbmVzTWlzbWF0Y2gAAAANAAAAT0VsIGVzY3JvdyBubyB1c2EgbGEgbW9uZWRhIGRlIGxhIHBsYXRhZm9ybWEgbyBjb2JyYSB1bmEgY29taXNpw7NuIG5vIHBlcm1pdGlkYS4AAAAAE0VzY3Jvd0Fzc2V0TWlzbWF0Y2gAAAAADgAAAChMYSBjYWxpZmljYWNpw7NuIGRlYmUgZXN0YXIgZW50cmUgMSB5IDUuAAAADUludmFsaWRSYXRpbmcAAAAAAAAPAAAAI0VsIGNvbWVudGFyaW8gc3VwZXJhIGxvcyAyODAgYnl0ZXMuAAAAAA5Db21tZW50VG9vTG9uZwAAAAAAEAAAAClZYSBkZWphc3RlIHVuYSByZXNlw7FhIHBhcmEgZXN0YSByZXNlcnZhLgAAAAAAAA9BbHJlYWR5UmV2aWV3ZWQAAAAAEQ==",
        "AAAAAQAAAAAAAAAAAAAABVNjb3JlAAAAAAAAAgAAABNSZXNlw7FhcyByZWNpYmlkYXMuAAAAAAVjb3VudAAAAAAAAAQAAAAuU3VtYSBkZSBjYWxpZmljYWNpb25lcy4gTWVkaWEgPSB0b3RhbCAvIGNvdW50LgAAAAAABXRvdGFsAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAABlJldmlldwAAAAAABgAAAAAAAAAKYm9va2luZ19pZAAAAAAABAAAAAAAAAAHY29tbWVudAAAAAAQAAAAEDEgYSA1IGVzdHJlbGxhcy4AAAAGcmF0aW5nAAAAAAAEAAAAAAAAAAhyZXZpZXdlcgAAABMAAAAAAAAAB3N1YmplY3QAAAAAEwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAACAAAAAAAAAAAAAAACVJlcXVlc3RlZAAAAAAAAAAAAAAAAAAACEFjY2VwdGVkAAAAAAAAAAAAAAAIUmVqZWN0ZWQAAAAAAAAAAAAAAAlDYW5jZWxsZWQAAAAAAAAAAAAAAAAAAAxFc2Nyb3dMaW5rZWQAAAAAAAAAAAAAAAlDb21wbGV0ZWQAAAAAAAAAAAAAAAAAAAhEaXNwdXRlZAAAAAAAAAAAAAAACFJlc29sdmVk",
        "AAAAAQAAAAAAAAAAAAAAB0Jvb2tpbmcAAAAADgAAADbDgXJiaXRybyBkZSBkaXNwdXRhcywgbGXDrWRvIGRlbCBlc2Nyb3cgYWwgdmluY3VsYXJsby4AAAAAAAdhcmJpdGVyAAAAA+gAAAATAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAAdkZXBvc2l0AAAAAAsAAAAAAAAAA2VuZAAAAAAGAAAAOkVzY3JvdyBkZSBUcnVzdGxlc3MgV29yayBxdWUgY3VzdG9kaWEgbG9zIGZvbmRvcyAoYEMuLi5gKS4AAAAAAAZlc2Nyb3cAAAAAA+gAAAATAAAAS0NvbWlzacOzbiBkZSBsYSBwbGF0YWZvcm1hIChoaXRvIHByb3BpbyBkZWwgZXNjcm93LCByZWNlcHRvciA9IHBsYXRhZm9ybWEpLgAAAAADZmVlAAAAAAsAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAApsaXN0aW5nX2lkAAAAAAAQAAAAAAAAAAVvd25lcgAAAAAAABMAAAAvSW1wb3J0ZXMgY29uIDcgZGVjaW1hbGVzICgxIFVTREMgPSAxMF8wMDBfMDAwKS4AAAAABHJlbnQAAAALAAAAK0luaWNpbyB5IGZpbiBkZWwgYWxxdWlsZXIgKHVuaXgsIHNlZ3VuZG9zKS4AAAAABXN0YXJ0AAAAAAAABgAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAAAAAAZ0ZW5hbnQAAAAAABMAAAAAAAAACnVwZGF0ZWRfYXQAAAAAAAY=",
        "AAAAAAAAAAAAAAAFY291bnQAAAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAFdG9rZW4AAAAAAAAAAAAAAQAAABM=",
        "AAAABQAAAAAAAAAAAAAADFJldmlld1Bvc3RlZAAAAAEAAAANcmV2aWV3X3Bvc3RlZAAAAAAAAAQAAAAAAAAAB3N1YmplY3QAAAAAEwAAAAEAAAAAAAAACmJvb2tpbmdfaWQAAAAAAAQAAAABAAAAAAAAAAhyZXZpZXdlcgAAABMAAAAAAAAAAAAAAAZyYXRpbmcAAAAAAAQAAAAAAAAAAg==",
        "AAAAAAAAADhFbCBwcm9waWV0YXJpbyBhY2VwdGEuIEJsb3F1ZWEgbGFzIGZlY2hhcyBwYXJhIGVzZSBiaWVuLgAAAAZhY2NlcHQAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAACaWQAAAAAAAQAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAEpDdWFscXVpZXJhIGRlIGxhcyBwYXJ0ZXMgY2FuY2VsYSBBTlRFUyBkZSBxdWUgZXhpc3RhIHVuIGVzY3JvdyBjb24gZm9uZG9zLgAAAAAABmNhbmNlbAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAC9FbCBwcm9waWV0YXJpbyByZWNoYXphIHVuYSBzb2xpY2l0dWQgcGVuZGllbnRlLgAAAAAGcmVqZWN0AAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAHpVbmEgcGFydGUgcmVzZcOxYSBhIGxhIG90cmEgdHJhcyB1bmEgcmVzZXJ2YSBjZXJyYWRhIChjb21wbGV0YWRhIG8gY29uCmRpc3B1dGEgcmVzdWVsdGEpLiBVbmEgcmVzZcOxYSBwb3IgcGFydGUgeSByZXNlcnZhLgAAAAAABnJldmlldwAAAAAABAAAAAAAAAAIcmV2aWV3ZXIAAAATAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAGcmF0aW5nAAAAAAAEAAAAAAAAAAdjb21tZW50AAAAABAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAEpFbCBhcnJlbmRhdGFyaW8gc29saWNpdGEgYWxxdWlsYXIgYGxpc3RpbmdfaWRgIGRlbCBgb3duZXJgIGVuIHVuIHBlcsOtb2RvLgAAAAAAB3JlcXVlc3QAAAAACAAAAAAAAAAGdGVuYW50AAAAAAATAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACmxpc3RpbmdfaWQAAAAAABAAAAAAAAAABXN0YXJ0AAAAAAAABgAAAAAAAAADZW5kAAAAAAYAAAAAAAAABHJlbnQAAAALAAAAAAAAAAdkZXBvc2l0AAAAAAsAAAAAAAAAA2ZlZQAAAAALAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAADpBY3R1YWxpemEgZWwgY8OzZGlnbyBkZWwgY29udHJhdG8gKHNvbG8gZWwgYWRtaW5pc3RyYWRvcikuAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAAl3YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAABQAAAAAAAAAAAAAADkJvb2tpbmdVcGRhdGVkAAAAAAABAAAAD2Jvb2tpbmdfdXBkYXRlZAAAAAAEAAAAAAAAAAJpZAAAAAAABAAAAAEAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAAAAAAAAAAAAAAAABnRlbmFudAAAAAAAEwAAAAAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAC",
        "AAAAAAAAAEhFbCBwcm9waWV0YXJpbyBjaWVycmEgbGEgcmVzZXJ2YSBjdWFuZG8gZWwgZXNjcm93IHlhIGxpYmVyw7MgbG9zIGZvbmRvcy4AAAAIY29tcGxldGUAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAACdQdW50dWFjacOzbiBhY3VtdWxhZGEgZGUgdW5hIGJpbGxldGVyYS4AAAAACHNjb3JlX29mAAAAAQAAAAAAAAADd2hvAAAAABMAAAABAAAH0AAAAAVTY29yZQAAAA==",
        "AAAAAAAAAAAAAAAKZ2V0X3JldmlldwAAAAAAAgAAAAAAAAACaWQAAAAAAAQAAAAAAAAACHJldmlld2VyAAAAEwAAAAEAAAPoAAAH0AAAAAZSZXZpZXcAAA==",
        "AAAAAAAAAEjDmmx0aW1hcyByZXNlw7FhcyByZWNpYmlkYXMgcG9yIHVuYSBiaWxsZXRlcmEgKGxhIG3DoXMgYW50aWd1YSBwcmltZXJvKS4AAAAKcmV2aWV3c19vZgAAAAAAAQAAAAAAAAADd2hvAAAAABMAAAABAAAD6gAAB9AAAAAGUmV2aWV3AAA=",
        "AAAAAAAAAH1JZHMgZGUgbGFzIHJlc2VydmFzIChyZWNpZW50ZXMpIGRlIHVuYSBiaWxsZXRlcmE6IGNvbW8gYXJyZW5kYXRhcmlvLApwcm9waWV0YXJpbyBvIMOhcmJpdHJvIChkZXNkZSBxdWUgc2UgdmluY3VsYSBlbCBlc2Nyb3cpLgAAAAAAAAtib29raW5nc19vZgAAAAABAAAAAAAAAAN3aG8AAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAAAAAAAALZ2V0X2Jvb2tpbmcAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAD6QAAB9AAAAAHQm9va2luZwAAAAAD",
        "AAAAAAAAAM5FbCBhcnJlbmRhdGFyaW8gdmluY3VsYSBlbCBlc2Nyb3cgcXVlIGN1c3RvZGlhIGVsIGFscXVpbGVyIHkgZWwgZGVww7NzaXRvLgpFbCBjb250cmF0byBsZWUgZWwgZXNjcm93IHkgY29tcHJ1ZWJhIHF1ZSBjb3JyZXNwb25kZSBhIGVzdGEgcmVzZXJ2YS4KVW4gZXNjcm93IHNvbG8gcHVlZGUgdmluY3VsYXJzZSB1bmEgdmV6IHkgYSB1bmEgc29sYSByZXNlcnZhLgAAAAAAC2xpbmtfZXNjcm93AAAAAAMAAAAAAAAABnRlbmFudAAAAAAAEwAAAAAAAAACaWQAAAAAAAQAAAAAAAAABmVzY3JvdwAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAEdDdWFscXVpZXJhIGRlIGxhcyBwYXJ0ZXMgYWJyZSB1bmEgZGlzcHV0YSBzb2JyZSB1bmEgcmVzZXJ2YSBjb24gZXNjcm93LgAAAAAMb3Blbl9kaXNwdXRlAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAIVgdG9rZW5gOiBjb250cmF0byBkZWwgYWN0aXZvIHF1ZSBjdXN0b2RpYW4gbG9zIGVzY3Jvd3MgKFVTREMgZW4gdGVzdG5ldDoKYENCSUVMVEs2WUJaSlU1VVAyV1dRRVVDWUtMUFU2QVVOWjJCUTRXV0ZFSUUzVVNDSUhNWFFEQU1BYCkuAAAAAAAADV9fY29uc3RydWN0b3IAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAA=",
        "AAAAAAAAADlJZHMgZGUgcmVzZXJ2YXMgYWNlcHRhZGFzIHkgYWJpZXJ0YXMgZGUgdW5hIHB1YmxpY2FjacOzbi4AAAAAAAAPYWN0aXZlX2Jvb2tpbmdzAAAAAAEAAAAAAAAACmxpc3RpbmdfaWQAAAAAABAAAAABAAAD6gAAAAQ=",
        "AAAAAAAAAHlFbCDDoXJiaXRybyBkZWwgZXNjcm93IChvIGVsIGFkbWluaXN0cmFkb3IpIG1hcmNhIGxhIGRpc3B1dGEgY29tbwpyZXN1ZWx0YS4gRWwgcmVwYXJ0byBkZSBmb25kb3Mgc2UgZWplY3V0YSBlbiBlbCBlc2Nyb3cuAAAAAAAAD3Jlc29sdmVfZGlzcHV0ZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAClSZXNlcnZhIHZpbmN1bGFkYSBhIHVuIGVzY3Jvdywgc2kgZXhpc3RlLgAAAAAAABFib29raW5nX29mX2VzY3JvdwAAAAAAAAEAAAAAAAAABmVzY3JvdwAAAAAAEwAAAAEAAAPoAAAABA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    count: this.txFromJSON<u32>,
        token: this.txFromJSON<string>,
        accept: this.txFromJSON<Result<void>>,
        cancel: this.txFromJSON<Result<void>>,
        reject: this.txFromJSON<Result<void>>,
        review: this.txFromJSON<Result<void>>,
        request: this.txFromJSON<Result<u32>>,
        upgrade: this.txFromJSON<null>,
        complete: this.txFromJSON<Result<void>>,
        score_of: this.txFromJSON<Score>,
        get_review: this.txFromJSON<Option<Review>>,
        reviews_of: this.txFromJSON<Array<Review>>,
        bookings_of: this.txFromJSON<Array<u32>>,
        get_booking: this.txFromJSON<Result<Booking>>,
        link_escrow: this.txFromJSON<Result<void>>,
        open_dispute: this.txFromJSON<Result<void>>,
        active_bookings: this.txFromJSON<Array<u32>>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        booking_of_escrow: this.txFromJSON<Option<u32>>
  }
}