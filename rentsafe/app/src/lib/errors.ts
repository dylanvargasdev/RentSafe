/**
 * Turn anything thrown (wallet rejections, contract errors, HTTP errors from
 * the Trustless Work API via axios) into a short human-readable message.
 */
export function errorMessage(e: unknown): string {
	if (typeof e === "string") return e
	if (e && typeof e === "object") {
		// axios-style error from the Trustless Work API
		const data = (e as { response?: { data?: unknown } }).response?.data
		if (data && typeof data === "object" && "message" in data) {
			const msg = (data as { message: unknown }).message
			return Array.isArray(msg) ? msg.join(", ") : String(msg)
		}
		if ("message" in e && typeof e.message === "string" && e.message) {
			return e.message
		}
	}
	return "Something went wrong. Check the browser console for details."
}
