/**
 * One consistent stroke icon set (24px grid, 1.8 stroke). No icon dependency.
 */
const PATHS = {
	home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
	car: "M5 16h14M6.5 16v2.5M17.5 16v2.5M4 16v-4l2-5.2A2 2 0 0 1 7.9 5.5h8.2a2 2 0 0 1 1.9 1.3L20 12v4M4 12h16M7.5 13.8h.01M16.5 13.8h.01",
	laptop:
		"M4.5 6.5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1V15h-15zM2.5 18.5h19M3 15h18l1 3.5H2z",
	tool: "M14.7 6.3a4 4 0 0 0-5.4 5l-6 6a1.4 1.4 0 0 0 2 2l6-6a4 4 0 0 0 5-5.4l-2.5 2.5-2-.6-.6-2z",
	search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM21 21l-5-5",
	heart:
		"M12 20.5S3.5 15.3 3.5 9.3A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 8.5 1.9c0 6-8.5 11.2-8.5 11.2z",
	user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0",
	plus: "M12 5v14M5 12h14",
	pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
	star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z",
	shield:
		"M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6zM8.8 12l2.2 2.2 4.4-4.4",
	lock: "M6.5 10.5h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3",
	wallet:
		"M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5zM16.5 13.5h.01",
	calendar:
		"M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8 3.5v4M16 3.5v4",
	check: "M5 12.5l4.5 4.5L19 7.5",
	x: "M6 6l12 12M18 6 6 18",
	chevronLeft: "M15 5l-7 7 7 7",
	chevronRight: "M9 5l7 7-7 7",
	chevronDown: "M5 9l7 7 7-7",
	filter: "M4 6h16M7 12h10M10 18h4",
	info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5h.01",
	alert: "M12 4 2.8 19.5h18.4zM12 10v4.5M12 17h.01",
	external:
		"M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
	clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
	menu: "M4 7h16M4 12h16M4 17h16",
	grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
	receipt: "M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
	upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
	edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
	arrowRight: "M5 12h14M13 6l6 6-6 6",
	users:
		"M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8",
	link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
	logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10",
	scale:
		"M12 4v16M6 20h12M5 8h14M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z",
} as const

export type IconName = keyof typeof PATHS

export const Icon = ({
	name,
	size = 20,
	filled = false,
	className,
	label,
}: {
	name: IconName
	size?: number
	filled?: boolean
	className?: string
	/** Accessible label. Without it the icon is decorative. */
	label?: string
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill={filled ? "currentColor" : "none"}
		stroke="currentColor"
		strokeWidth={1.8}
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		role={label ? "img" : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : true}
		focusable="false"
	>
		<path d={PATHS[name]} />
	</svg>
)
