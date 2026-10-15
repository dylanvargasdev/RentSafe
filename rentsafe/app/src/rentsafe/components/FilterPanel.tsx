import { useSearchParams } from "react-router-dom"
import { ATTRIBUTE_LABELS, CATEGORIES, UNIT_LABEL } from "../categories"
import { activeFilterCount, type Filters, PARAM } from "../search"
import { type PriceUnit } from "../types"
import styles from "./FilterPanel.module.css"

type Key = keyof Filters

/** Category-aware filters. Every change is written to the URL right away. */
export const FilterPanel = ({
	filters,
	fixedCategory,
}: {
	filters: Filters
	fixedCategory?: boolean
}) => {
	const [params, setParams] = useSearchParams()

	const setParam = (key: Key, value: string | undefined) => {
		const next = new URLSearchParams(params)
		if (value === undefined || value === "") next.delete(PARAM[key])
		else next.set(PARAM[key], value)
		setParams(next, { replace: true })
	}

	const select = (
		key: Key,
		label: string,
		options: Record<string, string>,
		value: string | undefined,
	) => (
		<label className="field">
			<span>{label}</span>
			<select
				value={value ?? ""}
				onChange={(e) => setParam(key, e.target.value)}
			>
				<option value="">Cualquiera</option>
				{Object.entries(options).map(([v, l]) => (
					<option key={v} value={v}>
						{l}
					</option>
				))}
			</select>
		</label>
	)

	const numberField = (
		key: Key,
		label: string,
		value: number | undefined,
		placeholder: string,
	) => (
		<label className="field">
			<span>{label}</span>
			<input
				type="number"
				min={0}
				inputMode="numeric"
				value={value ?? ""}
				placeholder={placeholder}
				onChange={(e) => setParam(key, e.target.value)}
			/>
		</label>
	)

	const unitOptions = (units: PriceUnit[]) =>
		Object.fromEntries(units.map((u) => [u, `Por ${UNIT_LABEL[u].one}`]))

	const cat = filters.category
	const count = activeFilterCount(filters)

	return (
		<div className={styles.panel}>
			{!fixedCategory && (
				<div className={styles.chips} role="group" aria-label="Categoría">
					<button
						type="button"
						className="chip"
						aria-pressed={!cat}
						onClick={() => setParam("category", undefined)}
					>
						Todas
					</button>
					{CATEGORIES.map((c) => (
						<button
							key={c.id}
							type="button"
							className="chip"
							aria-pressed={cat === c.id}
							onClick={() => setParam("category", c.id)}
						>
							{c.label}
						</button>
					))}
				</div>
			)}

			<div className={styles.fields}>
				{cat === "alojamiento" && (
					<>
						{numberField("guests", "Huéspedes", filters.guests, "Cualquiera")}
						{numberField(
							"bedrooms",
							"Habitaciones (mín.)",
							filters.bedrooms,
							"Cualquiera",
						)}
						{select(
							"propertyType",
							"Tipo de alojamiento",
							ATTRIBUTE_LABELS.propertyType,
							filters.propertyType,
						)}
					</>
				)}
				{cat === "vehiculos" && (
					<>
						{select(
							"vehicleType",
							"Tipo de vehículo",
							ATTRIBUTE_LABELS.vehicleType,
							filters.vehicleType,
						)}
						{select(
							"transmission",
							"Transmisión",
							ATTRIBUTE_LABELS.transmission,
							filters.transmission,
						)}
						{select(
							"unit",
							"Modalidad de cobro",
							unitOptions(["hora", "dia", "semana"]),
							filters.unit,
						)}
					</>
				)}
				{cat === "tecnologia" && (
					<>
						{select(
							"deviceType",
							"Tipo de dispositivo",
							ATTRIBUTE_LABELS.deviceType,
							filters.deviceType,
						)}
						{select(
							"condition",
							"Estado",
							ATTRIBUTE_LABELS.condition,
							filters.condition,
						)}
					</>
				)}
				{cat === "equipo" && (
					<>
						{select(
							"equipmentType",
							"Tipo de equipo",
							ATTRIBUTE_LABELS.equipmentType,
							filters.equipmentType,
						)}
						{select(
							"unit",
							"Duración del alquiler",
							unitOptions(["hora", "dia", "semana"]),
							filters.unit,
						)}
					</>
				)}
				{numberField("minPrice", "Precio mín.", filters.minPrice, "0")}
				{numberField("maxPrice", "Precio máx.", filters.maxPrice, "Sin límite")}
				<label className="field">
					<span>Ordenar por</span>
					<select
						value={filters.sort}
						onChange={(e) =>
							setParam(
								"sort",
								e.target.value === "relevancia" ? undefined : e.target.value,
							)
						}
					>
						<option value="relevancia">Recomendados</option>
						<option value="precio_asc">Precio: menor a mayor</option>
						<option value="precio_desc">Precio: mayor a menor</option>
						<option value="valoracion">Mejor valorados</option>
					</select>
				</label>
				<label className={`check ${styles.avail}`}>
					<input
						type="checkbox"
						checked={filters.onlyAvailable}
						onChange={(e) =>
							setParam("onlyAvailable", e.target.checked ? "1" : undefined)
						}
					/>
					Solo disponibles
				</label>
			</div>
			{count > 0 && (
				<button
					type="button"
					className="btn btn-sm btn-ghost"
					onClick={() => {
						const next = new URLSearchParams()
						if (!fixedCategory && cat) next.set(PARAM.category, cat)
						setParams(next, { replace: true })
					}}
				>
					Limpiar filtros ({count})
				</button>
			)}
		</div>
	)
}
