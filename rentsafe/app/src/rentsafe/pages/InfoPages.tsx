import { useEffect } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { platformAddress } from "../../trustless/config"
import { STATUS } from "../bookingStatus"
import { RENTSAFE } from "../config"
import { FundsFlow } from "../components/FundsFlow"
import { Callout, EmptyState, StatusBadge } from "../components/ui"
import { type BookingStatus } from "../types"
import styles from "./InfoPages.module.css"

const ORDER: BookingStatus[] = [
	"requested",
	"accepted",
	"funded",
	"active",
	"return_review",
	"completed",
	"disputed",
	"resolved",
	"rejected",
	"cancelled",
]

export const HowItWorksPage = () => {
	const { hash } = useLocation()
	useEffect(() => {
		if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
	}, [hash])
	return (
		<div className={`rs-container section ${styles.page}`}>
			<h1>Cómo funciona RentSafe</h1>
			<p className={styles.lead}>
				RentSafe une a quien necesita algo por un tiempo con quien lo tiene. La
				diferencia es dónde espera el dinero: en un escrow en Stellar, con
				reglas que ninguna de las partes puede saltarse.
			</p>

			<section className={styles.block}>
				<h2>Qué hace cada pieza</h2>
				<dl className={styles.defs}>
					<div>
						<dt>Escrow (Trustless Work)</dt>
						<dd>
							Un contrato inteligente por reserva que guarda alquiler y depósito
							en USDC. Tiene dos hitos: el alquiler, que se paga al propietario,
							y el depósito, que vuelve al arrendatario. Cada hito solo se mueve
							con la firma de la persona correcta.
						</dd>
					</div>
					<div>
						<dt>Registro de alquileres (contrato Soroban propio)</dt>
						<dd>
							Guarda el acuerdo: qué bien, entre qué billeteras, en qué fechas y
							por qué importes. Impide aceptar dos reservas con fechas solapadas
							y que un mismo escrow se use para dos reservas.
						</dd>
					</div>
					<div>
						<dt>Billetera (Cavos o extensión)</dt>
						<dd>
							Con Cavos entras con tu correo o Google y obtienes una cuenta
							Stellar sin instalar nada. Tu llave queda en un entorno aislado:
							ni RentSafe ni Cavos pueden firmar por ti.
						</dd>
					</div>
					<div>
						<dt>RentSafe (fuera de la cadena)</dt>
						<dd>
							Fotos, descripciones, perfiles y búsqueda. Nada personal se
							publica en la blockchain.
						</dd>
					</div>
				</dl>
			</section>

			<section className={styles.block} id="proteccion">
				<h2>Quién puede mover el dinero</h2>
				<FundsFlow
					rent={240}
					deposit={300}
					funded
					rentReleased={false}
					depositReleased={false}
				/>
				<ul className={styles.rules}>
					<li>
						<strong>Alquiler:</strong> el arrendatario aprueba al recibir el
						bien; solo entonces el propietario puede liberarlo a su billetera.
					</li>
					<li>
						<strong>Depósito:</strong> el arrendatario aprueba el reembolso y el
						propietario lo libera al comprobar la devolución. Ninguno puede
						hacerlo solo.
					</li>
					<li>
						<strong>Disputa:</strong> cualquiera de los dos puede bloquear el
						depósito. El árbitro de la plataforma decide el reparto; no puede
						abrir disputas ni quedarse fondos para sí.
						{!platformAddress &&
							" En esta demo no hay árbitro configurado: la billetera del arrendatario cumple ese papel."}
					</li>
					<li>
						<strong>Comisiones:</strong> RentSafe cobra{" "}
						{RENTSAFE.serviceFeePercent}% (parámetro de demostración). Trustless
						Work descuenta un{" "}
						{String(RENTSAFE.protocolFeePercent).replace(".", ",")}% de cada
						liberación.
					</li>
				</ul>
				<Callout icon="info">
					Un contrato no puede comprobar si un bien volvió en buen estado. Ese
					hecho lo confirman las partes con su firma, con evidencia registrada
					en el escrow, o el árbitro si no hay acuerdo.
				</Callout>
			</section>

			<section className={styles.block}>
				<h2>Estados de una reserva</h2>
				<ul className={styles.states}>
					{ORDER.map((s) => (
						<li key={s}>
							<StatusBadge status={s} />
							<span>{STATUS[s].help}</span>
						</li>
					))}
				</ul>
			</section>

			<section className={styles.block}>
				<h2>Real o simulado</h2>
				<p>
					Cada reserva indica su modo. <strong>On-chain</strong>: transacciones
					reales en Stellar testnet con USDC de prueba, con enlace al
					explorador. <strong>Simulación</strong>: el mismo flujo sin
					blockchain, con referencias que empiezan por SIM-.{" "}
					<strong>Demostración</strong>: datos de ejemplo para llenar los
					paneles.
				</p>
				<Link
					to="/buscar"
					className="btn btn-primary"
					style={{ justifySelf: "start" }}
				>
					Explorar bienes
				</Link>
			</section>
		</div>
	)
}

const LEGAL: Record<string, { title: string; body: string[] }> = {
	terminos: {
		title: "Términos de uso",
		body: [
			"RentSafe es un prototipo que funciona en Stellar testnet. Ningún pago usa dinero real y los activos de prueba no tienen valor.",
			"Los propietarios son responsables de la veracidad de sus publicaciones. Los arrendatarios se comprometen a devolver los bienes en el estado en que los recibieron.",
			"Las reglas de pago y devolución las ejecuta un escrow en Stellar. RentSafe no custodia fondos.",
		],
	},
	privacidad: {
		title: "Privacidad",
		body: [
			"Tu nombre, correo y ciudad se guardan en este navegador. En el prototipo no hay servidor.",
			"En la blockchain solo se publican direcciones de billetera, fechas, importes y el identificador de la publicación. Nunca datos personales.",
			"Las notas de devolución quedan como evidencia pública en el escrow: no incluyas datos personales en ellas.",
		],
	},
	cancelaciones: {
		title: "Cancelaciones y disputas",
		body: [
			"Antes de depositar fondos, cualquiera de las partes puede cancelar sin costo.",
			"Una vez depositados, el alquiler solo se libera al propietario cuando el arrendatario confirma la entrega, y el depósito solo vuelve al arrendatario con la aprobación de ambos.",
			"Si hay daños o desacuerdo, cualquiera puede abrir una disputa sobre el depósito. El árbitro de la plataforma decide el reparto y lo ejecuta el escrow.",
			"Limitación del prototipo: si el bien nunca se entrega, el alquiler queda retenido (el propietario no puede cobrarlo), pero la disputa sobre el hito de alquiler aún no está disponible en la interfaz.",
		],
	},
}

export const LegalPage = () => {
	const { doc } = useParams()
	const page = doc ? LEGAL[doc] : undefined
	if (!page)
		return (
			<div className="rs-container section">
				<EmptyState
					title="Página no encontrada"
					action={
						<Link to="/" className="btn">
							Ir al inicio
						</Link>
					}
				/>
			</div>
		)
	return (
		<div className={`rs-container section ${styles.page}`}>
			<h1>{page.title}</h1>
			<Callout tone="warning" icon="alert">
				Borrador para la demostración. No es un documento legal vigente.
			</Callout>
			{page.body.map((p) => (
				<p key={p} className={styles.para}>
					{p}
				</p>
			))}
		</div>
	)
}

export const NotFoundPage = () => (
	<div className="rs-container section">
		<EmptyState
			title="Esta página no existe"
			action={
				<Link to="/" className="btn btn-primary">
					Ir al inicio
				</Link>
			}
		/>
	</div>
)
