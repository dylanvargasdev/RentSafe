import { type CategoryId, type PriceUnit } from "./types"

export interface CategoryInfo {
	id: CategoryId
	label: string
	short: string
	icon: "home" | "car" | "laptop" | "tool"
	tagline: string
	/** "range": start + end dates (nights/days). "duration": start date + amount. */
	dateMode: "range" | "duration"
	defaultUnit: PriceUnit
	units: PriceUnit[]
}

export const CATEGORIES: CategoryInfo[] = [
	{
		id: "alojamiento",
		label: "Alojamiento",
		short: "Alojamiento",
		icon: "home",
		tagline: "Casas, apartamentos, habitaciones y estancias vacacionales",
		dateMode: "range",
		defaultUnit: "noche",
		units: ["noche", "semana"],
	},
	{
		id: "vehiculos",
		label: "Vehículos",
		short: "Vehículos",
		icon: "car",
		tagline: "Autos, motos, bicicletas y scooters",
		dateMode: "range",
		defaultUnit: "dia",
		units: ["dia", "hora", "semana"],
	},
	{
		id: "tecnologia",
		label: "Tecnología",
		short: "Tecnología",
		icon: "laptop",
		tagline: "Laptops, cámaras, consolas y electrónica",
		dateMode: "duration",
		defaultUnit: "dia",
		units: ["dia", "semana"],
	},
	{
		id: "equipo",
		label: "Equipo de trabajo",
		short: "Equipo",
		icon: "tool",
		tagline: "Herramientas, maquinaria y equipo profesional",
		dateMode: "duration",
		defaultUnit: "dia",
		units: ["hora", "dia", "semana"],
	},
]

export const categoryById = (id: string | undefined) =>
	CATEGORIES.find((c) => c.id === id)

export const isCategoryId = (id: string | undefined): id is CategoryId =>
	Boolean(categoryById(id))

export const UNIT_LABEL: Record<PriceUnit, { one: string; many: string }> = {
	noche: { one: "noche", many: "noches" },
	dia: { one: "día", many: "días" },
	hora: { one: "hora", many: "horas" },
	semana: { one: "semana", many: "semanas" },
}

export const unitLabel = (unit: PriceUnit, n: number) =>
	n === 1 ? UNIT_LABEL[unit].one : UNIT_LABEL[unit].many

/** Option labels for category-specific attributes. */
export const ATTRIBUTE_LABELS = {
	propertyType: {
		casa: "Casa",
		apartamento: "Apartamento",
		habitacion: "Habitación",
		cabana: "Cabaña",
	},
	vehicleType: {
		auto: "Automóvil",
		moto: "Motocicleta",
		bicicleta: "Bicicleta",
		scooter: "Scooter eléctrico",
	},
	transmission: { automatica: "Automática", manual: "Manual" },
	deviceType: {
		laptop: "Laptop",
		camara: "Cámara",
		consola: "Consola",
		telefono: "Teléfono",
		audio: "Audio",
		dron: "Dron",
	},
	condition: {
		nuevo: "Nuevo",
		como_nuevo: "Como nuevo",
		buen_estado: "Buen estado",
	},
	equipmentType: {
		herramienta: "Herramienta",
		maquinaria: "Maquinaria",
		construccion: "Construcción",
		jardineria: "Jardinería",
	},
} as const
