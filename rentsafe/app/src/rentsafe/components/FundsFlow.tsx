import { money } from "../config"
import { Icon } from "./Icon"
import styles from "./FundsFlow.module.css"

type Step = "pending" | "held" | "done" | "blocked"

/**
 * Where the money is. The rent goes Tenant → Escrow → Owner; the deposit goes
 * Tenant → Escrow → back to Tenant (or is split by the arbiter in a dispute).
 */
export const FundsFlow = ({
	rent,
	deposit,
	funded,
	rentReleased,
	depositReleased,
	disputed,
	tenantLabel = "Arrendatario",
	ownerLabel = "Propietario",
}: {
	rent: number
	deposit: number
	funded: boolean
	rentReleased: boolean
	depositReleased: boolean
	disputed?: boolean
	tenantLabel?: string
	ownerLabel?: string
}) => {
	const held = funded
		? (rentReleased ? 0 : rent) + (depositReleased ? 0 : deposit)
		: 0
	const rentStep: Step = rentReleased ? "done" : funded ? "held" : "pending"
	const depStep: Step = depositReleased
		? "done"
		: disputed
			? "blocked"
			: funded
				? "held"
				: "pending"

	return (
		<figure className={styles.flow} aria-label="Flujo de fondos del alquiler">
			<div className={styles.node}>
				<span className={styles.nodeIcon}>
					<Icon name="user" size={20} />
				</span>
				<strong>{tenantLabel}</strong>
				<span className="small muted">Paga alquiler + depósito</span>
			</div>

			<div
				className={`${styles.wire} ${funded ? styles.wireOn : ""}`}
				aria-hidden
			/>

			<div
				className={`${styles.node} ${styles.vault} ${held > 0 ? styles.vaultOn : ""}`}
			>
				<span className={styles.nodeIcon}>
					<Icon name="lock" size={20} />
				</span>
				<strong>Escrow en Stellar</strong>
				<span className={`num ${styles.held}`}>{money(held)}</span>
				<span className="small">
					{held > 0
						? "custodiados por el contrato"
						: funded
							? "sin fondos pendientes"
							: "aún sin fondos"}
				</span>
			</div>

			<div className={styles.branches}>
				<div className={`${styles.branch} ${styles[`b_${rentStep}`]}`}>
					<span className={styles.branchHead}>
						<Icon
							name={rentStep === "done" ? "check" : "arrowRight"}
							size={16}
						/>
						Alquiler {money(rent)}
					</span>
					<span className="small">
						a {ownerLabel}
						{rentStep === "done"
							? ": pagado"
							: rentStep === "held"
								? ": se libera cuando el arrendatario confirma la entrega"
								: ""}
					</span>
				</div>
				{deposit > 0 && (
					<div className={`${styles.branch} ${styles[`b_${depStep}`]}`}>
						<span className={styles.branchHead}>
							<Icon
								name={
									depStep === "done"
										? "check"
										: depStep === "blocked"
											? "scale"
											: "chevronLeft"
								}
								size={16}
							/>
							Depósito {money(deposit)}
						</span>
						<span className="small">
							{depStep === "blocked"
								? "bloqueado: lo reparte el árbitro"
								: `de vuelta a ${tenantLabel}${depStep === "done" ? ": devuelto" : depStep === "held" ? " tras revisar la devolución" : ""}`}
						</span>
					</div>
				)}
			</div>
		</figure>
	)
}
