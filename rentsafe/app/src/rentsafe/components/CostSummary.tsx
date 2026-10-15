import { unitLabel } from "../categories"
import { money, RENTSAFE } from "../config"
import { type Quote } from "../pricing"
import { type PriceUnit } from "../types"
import styles from "./CostSummary.module.css"

/** Rent, deposit, fee and total, always shown separately. */
export const CostSummary = ({
	quote,
	price,
	unit,
}: {
	quote: Pick<Quote, "units" | "rent" | "deposit" | "fee" | "total">
	price: number
	unit: PriceUnit
}) => (
	<dl className={styles.list}>
		<div>
			<dt>
				{money(price)} × <span className="num">{quote.units}</span>{" "}
				{unitLabel(unit, quote.units)}
			</dt>
			<dd className="num">{money(quote.rent)}</dd>
		</div>
		<div>
			<dt>
				Depósito de garantía
				<span className={styles.note}>
					Reembolsable: vuelve a ti al devolver el bien
				</span>
			</dt>
			<dd className="num">
				{quote.deposit > 0 ? money(quote.deposit) : "Sin depósito"}
			</dd>
		</div>
		<div>
			<dt>
				Comisión de servicio ({RENTSAFE.serviceFeePercent}%)
				<span className={styles.note}>
					Parámetro de demostración, configurable
				</span>
			</dt>
			<dd className="num">{money(quote.fee)}</dd>
		</div>
		<div className={styles.total}>
			<dt>Total</dt>
			<dd className="num">{money(quote.total)}</dd>
		</div>
	</dl>
)
