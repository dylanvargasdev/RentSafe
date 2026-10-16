import { useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
	ATTRIBUTE_LABELS,
	CATEGORIES,
	categoryById,
	UNIT_LABEL,
} from "../categories"
import { Icon } from "../components/Icon"
import { BackLink, Callout, EmptyState, Photo } from "../components/ui"
import { actions, ME, useRentSafe } from "../store/useRentSafe"
import {
	type CategoryId,
	type Listing,
	type ListingAttributes,
	type PriceUnit,
} from "../types"
import styles from "./ListingFormPage.module.css"

const MAX_PHOTOS = 5

/** Resize an uploaded photo to ≤1200px JPEG so it fits in local storage. */
function resizeImage(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onerror = () => reject(new Error("No se pudo leer la imagen"))
		reader.onload = () => {
			const img = new Image()
			img.onerror = () =>
				reject(new Error("El archivo no es una imagen válida"))
			img.onload = () => {
				const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
				const canvas = document.createElement("canvas")
				canvas.width = Math.round(img.width * scale)
				canvas.height = Math.round(img.height * scale)
				canvas
					.getContext("2d")
					?.drawImage(img, 0, 0, canvas.width, canvas.height)
				resolve(canvas.toDataURL("image/jpeg", 0.72))
			}
			img.src = reader.result as string
		}
		reader.readAsDataURL(file)
	})
}

const lines = (s: string) =>
	s
		.split(/\n|,/)
		.map((x) => x.trim())
		.filter(Boolean)

type Form = {
	category: CategoryId
	title: string
	description: string
	location: string
	region: string
	price: string
	unit: PriceUnit
	minUnits: string
	deposit: string
	features: string
	requirements: string
	images: string[]
	available: boolean
	attributes: ListingAttributes
}

const toForm = (l?: Listing): Form => ({
	category: l?.category ?? "alojamiento",
	title: l?.title ?? "",
	description: l?.description ?? "",
	location: l?.location ?? "",
	region: l?.region ?? "",
	price: l ? String(l.price) : "",
	unit: l?.unit ?? "noche",
	minUnits: l ? String(l.minUnits) : "1",
	deposit: l ? String(l.deposit) : "",
	features: l?.features.join("\n") ?? "",
	requirements: l?.requirements.join("\n") ?? "Identificación válida",
	images: l?.images ?? [],
	available: l?.available ?? true,
	attributes: l?.attributes ?? {},
})

export const ListingFormPage = () => {
	const { id } = useParams()
	const state = useRentSafe()
	const navigate = useNavigate()
	const existing = id ? state.listings.find((l) => l.id === id) : undefined
	const [f, setF] = useState<Form>(() => toForm(existing))
	const [errors, setErrors] = useState<
		Partial<Record<keyof Form | "form", string>>
	>({})
	const [imageUrl, setImageUrl] = useState("")
	const [uploading, setUploading] = useState(false)

	if (id && (!existing || existing.ownerId !== ME))
		return (
			<div className="rs-container section">
				<EmptyState
					title="No puedes editar esta publicación"
					action={
						<Link to="/propietario" className="btn">
							Volver al panel
						</Link>
					}
				>
					Solo el propietario puede editarla.
				</EmptyState>
			</div>
		)

	const cat = categoryById(f.category)!
	const set = <K extends keyof Form>(k: K, v: Form[K]) =>
		setF((p) => ({ ...p, [k]: v }))
	const setAttr = (patch: ListingAttributes) =>
		setF((p) => ({ ...p, attributes: { ...p.attributes, ...patch } }))

	const onFiles = async (files: FileList | null) => {
		if (!files?.length) return
		setUploading(true)
		try {
			const room = MAX_PHOTOS - f.images.length
			const urls = await Promise.all([...files].slice(0, room).map(resizeImage))
			setF((p) => ({ ...p, images: [...p.images, ...urls] }))
			setErrors((e) => ({ ...e, images: undefined }))
		} catch (e) {
			setErrors((er) => ({ ...er, images: (e as Error).message }))
		} finally {
			setUploading(false)
		}
	}

	const submit = (e: FormEvent) => {
		e.preventDefault()
		const err: typeof errors = {}
		const price = Number(f.price)
		const deposit = Number(f.deposit || 0)
		const minUnits = Number(f.minUnits || 1)
		if (f.title.trim().length < 6) err.title = "Usa al menos 6 caracteres."
		if (f.description.trim().length < 20)
			err.description = "Describe el bien con al menos 20 caracteres."
		if (f.location.trim().length < 3)
			err.location = "Indica la ciudad o zona (no la dirección exacta)."
		if (!(price > 0)) err.price = "El precio debe ser mayor que 0."
		if (!(deposit >= 0)) err.deposit = "El depósito no puede ser negativo."
		if (!(minUnits >= 1) || !Number.isInteger(minUnits))
			err.minUnits = "Usa un número entero desde 1."
		if (!f.images.length) err.images = "Agrega al menos una foto."
		setErrors(err)
		if (Object.keys(err).length) {
			document
				.querySelector("[aria-invalid='true']")
				?.scrollIntoView({ behavior: "smooth", block: "center" })
			return
		}
		const newId = actions.saveListing({
			id: existing?.id,
			category: f.category,
			title: f.title.trim(),
			description: f.description.trim(),
			location: f.location.trim(),
			region: f.region.trim() || f.location.trim(),
			price,
			unit: f.unit,
			minUnits,
			deposit,
			images: f.images,
			features: lines(f.features),
			requirements: lines(f.requirements),
			attributes: f.attributes,
			available: f.available,
			blocked: existing?.blocked ?? [],
		})
		void navigate(`/bien/${newId}`)
	}

	const err = (k: keyof Form) =>
		errors[k] ? (
			<span className="error-text" role="alert">
				{errors[k]}
			</span>
		) : null

	const attrSelect = <K extends keyof typeof ATTRIBUTE_LABELS>(
		key: K,
		label: string,
	) => (
		<label className="field">
			<span>{label}</span>
			<select
				value={
					(f.attributes[key as keyof ListingAttributes] as
						| string
						| undefined) ?? ""
				}
				onChange={(e) =>
					setAttr({ [key]: e.target.value || undefined } as ListingAttributes)
				}
			>
				<option value="">Sin especificar</option>
				{Object.entries(ATTRIBUTE_LABELS[key]).map(([v, l]) => (
					<option key={v} value={v}>
						{l}
					</option>
				))}
			</select>
		</label>
	)
	const attrNumber = (
		key: "guests" | "bedrooms" | "minDriverAge",
		label: string,
	) => (
		<label className="field">
			<span>{label}</span>
			<input
				type="number"
				min={0}
				value={f.attributes[key] ?? ""}
				onChange={(e) =>
					setAttr({
						[key]: e.target.value ? Number(e.target.value) : undefined,
					} as ListingAttributes)
				}
			/>
		</label>
	)

	return (
		<div className="rs-container section" style={{ maxWidth: 880 }}>
			<BackLink to="/propietario">Panel de propietario</BackLink>
			<h1 style={{ fontSize: "1.8rem", margin: "14px 0 4px" }}>
				{existing ? "Editar publicación" : "Publicar un bien"}
			</h1>
			<p className="muted">
				Los datos de la publicación se guardan fuera de la blockchain: puedes
				editarlos cuando quieras.
			</p>

			<form className={styles.form} onSubmit={submit} noValidate>
				<section className={styles.section}>
					<h2 className={styles.h2}>Categoría</h2>
					<div className={styles.cats} role="radiogroup" aria-label="Categoría">
						{CATEGORIES.map((c) => (
							<label
								key={c.id}
								className={`${styles.cat} ${f.category === c.id ? styles.catOn : ""}`}
							>
								<input
									type="radio"
									name="category"
									className="sr-only"
									checked={f.category === c.id}
									onChange={() =>
										setF((p) => ({
											...p,
											category: c.id,
											unit: c.units.includes(p.unit) ? p.unit : c.defaultUnit,
											attributes: {},
										}))
									}
								/>
								<Icon name={c.icon} size={24} />
								<span>{c.label}</span>
							</label>
						))}
					</div>
				</section>

				<section className={styles.section}>
					<h2 className={styles.h2}>Descripción</h2>
					<label className="field">
						<span>Título</span>
						<input
							value={f.title}
							maxLength={80}
							onChange={(e) => set("title", e.target.value)}
							aria-invalid={Boolean(errors.title) || undefined}
							placeholder="Ej.: Cámara mirrorless con lente 24-70"
						/>
						{err("title")}
					</label>
					<label className="field">
						<span>Descripción</span>
						<textarea
							value={f.description}
							maxLength={1200}
							onChange={(e) => set("description", e.target.value)}
							aria-invalid={Boolean(errors.description) || undefined}
						/>
						{err("description")}
					</label>
					<div className="form-grid">
						<label className="field">
							<span>Ciudad o zona</span>
							<input
								value={f.location}
								onChange={(e) => set("location", e.target.value)}
								aria-invalid={Boolean(errors.location) || undefined}
								placeholder="Ej.: Escazú, San José"
							/>
							<span className="hint">Nunca publiques la dirección exacta.</span>
							{err("location")}
						</label>
						<label className="field">
							<span>Provincia o región</span>
							<input
								value={f.region}
								onChange={(e) => set("region", e.target.value)}
								placeholder="Ej.: San José"
							/>
						</label>
					</div>
				</section>

				<section className={styles.section}>
					<h2 className={styles.h2}>Detalles de {cat.label.toLowerCase()}</h2>
					<div className="form-grid">
						{f.category === "alojamiento" && (
							<>
								{attrSelect("propertyType", "Tipo de alojamiento")}
								{attrNumber("guests", "Huéspedes máximos")}
								{attrNumber("bedrooms", "Habitaciones")}
							</>
						)}
						{f.category === "vehiculos" && (
							<>
								{attrSelect("vehicleType", "Tipo de vehículo")}
								{attrSelect("transmission", "Transmisión")}
								{attrNumber("minDriverAge", "Edad mínima del conductor")}
							</>
						)}
						{f.category === "tecnologia" && (
							<>
								{attrSelect("deviceType", "Tipo de dispositivo")}
								{attrSelect("condition", "Estado")}
							</>
						)}
						{f.category === "equipo" &&
							attrSelect("equipmentType", "Tipo de equipo")}
					</div>
					<label className="field">
						<span>Características (una por línea)</span>
						<textarea
							value={f.features}
							onChange={(e) => set("features", e.target.value)}
							placeholder={"Wifi\nParqueo"}
						/>
					</label>
				</section>

				<section className={styles.section}>
					<h2 className={styles.h2}>Precio y garantía</h2>
					<div className="form-grid">
						<label className="field">
							<span>Precio (USDC)</span>
							<input
								type="number"
								min={0}
								step="0.01"
								inputMode="decimal"
								value={f.price}
								onChange={(e) => set("price", e.target.value)}
								aria-invalid={Boolean(errors.price) || undefined}
							/>
							{err("price")}
						</label>
						<label className="field">
							<span>Unidad de cobro</span>
							<select
								value={f.unit}
								onChange={(e) => set("unit", e.target.value as PriceUnit)}
							>
								{cat.units.map((u) => (
									<option key={u} value={u}>
										Por {UNIT_LABEL[u].one}
									</option>
								))}
							</select>
						</label>
						<label className="field">
							<span>Mínimo de {UNIT_LABEL[f.unit].many}</span>
							<input
								type="number"
								min={1}
								step={1}
								value={f.minUnits}
								onChange={(e) => set("minUnits", e.target.value)}
								aria-invalid={Boolean(errors.minUnits) || undefined}
							/>
							{err("minUnits")}
						</label>
						<label className="field">
							<span>Depósito de garantía (USDC)</span>
							<input
								type="number"
								min={0}
								step="1"
								inputMode="decimal"
								value={f.deposit}
								onChange={(e) => set("deposit", e.target.value)}
								aria-invalid={Boolean(errors.deposit) || undefined}
								placeholder="0"
							/>
							<span className="hint">
								Se custodia en el escrow y vuelve al arrendatario.
							</span>
							{err("deposit")}
						</label>
					</div>
					<label className="field">
						<span>Requisitos y condiciones (uno por línea)</span>
						<textarea
							value={f.requirements}
							onChange={(e) => set("requirements", e.target.value)}
						/>
					</label>
				</section>

				<section className={styles.section}>
					<h2 className={styles.h2}>Fotos</h2>
					<div className={styles.photos}>
						{f.images.map((src, i) => (
							<div key={src.slice(-40) + i} className={styles.photo}>
								<Photo
									src={src}
									alt={`Foto ${i + 1}`}
									category={f.category}
									className={styles.photoImg}
								/>
								{i === 0 && <span className={styles.cover}>Portada</span>}
								<button
									type="button"
									className={`icon-btn ${styles.remove}`}
									aria-label={`Quitar foto ${i + 1}`}
									onClick={() =>
										set(
											"images",
											f.images.filter((_, k) => k !== i),
										)
									}
								>
									<Icon name="x" size={16} />
								</button>
							</div>
						))}
						{f.images.length < MAX_PHOTOS && (
							<label
								className={styles.upload}
								aria-invalid={Boolean(errors.images) || undefined}
							>
								<input
									type="file"
									accept="image/*"
									multiple
									className="sr-only"
									onChange={(e) => void onFiles(e.target.files)}
								/>
								<Icon name="upload" size={22} />
								<span>{uploading ? "Procesando…" : "Subir fotos"}</span>
							</label>
						)}
					</div>
					<div className="row">
						<input
							className="input"
							style={{ flex: 1, minWidth: 0 }}
							value={imageUrl}
							onChange={(e) => setImageUrl(e.target.value)}
							placeholder="o pega la URL https:// de una imagen"
							aria-label="URL de una imagen"
						/>
						<button
							type="button"
							className="btn"
							disabled={
								!/^https:\/\/\S+$/.test(imageUrl) ||
								f.images.length >= MAX_PHOTOS
							}
							onClick={() => {
								set("images", [...f.images, imageUrl])
								setImageUrl("")
							}}
						>
							Agregar
						</button>
					</div>
					<span className="small muted">
						Hasta {MAX_PHOTOS} fotos. Se reducen a 1200 px y se guardan en este
						navegador.
					</span>
					{err("images")}
				</section>

				<section className={styles.section}>
					<h2 className={styles.h2}>Disponibilidad</h2>
					<label className="check">
						<input
							type="checkbox"
							checked={f.available}
							onChange={(e) => set("available", e.target.checked)}
						/>
						Disponible para reservar
					</label>
					<span className="small muted">
						Las fechas reservadas se bloquean automáticamente al aceptar cada
						solicitud.
					</span>
				</section>

				{Object.keys(errors).length > 0 && (
					<Callout tone="danger" icon="alert">
						Revisa los campos marcados.
					</Callout>
				)}
				<div className={styles.actions}>
					<Link to="/propietario" className="btn">
						Cancelar
					</Link>
					<button type="submit" className="btn btn-primary btn-lg">
						{existing ? "Guardar cambios" : "Publicar"}
					</button>
				</div>
			</form>
		</div>
	)
}
