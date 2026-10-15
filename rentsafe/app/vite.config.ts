import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		nodePolyfills({
			include: ["buffer"],
			globals: {
				Buffer: true,
			},
		}),
		wasm(),
	],
	build: {
		target: "esnext",
	},
	optimizeDeps: {
		exclude: ["@stellar/stellar-xdr-json"],
	},
	define: {
		global: "window",
	},
	envPrefix: "PUBLIC_",
	server: {
		// Fixed port: Cavos only allows the origins registered in its dashboard
		// (http://localhost:5173), so fail loudly instead of moving to 5174.
		port: 5173,
		strictPort: true,
		proxy: {
			"/friendbot": {
				target: "http://localhost:8000/friendbot",
				changeOrigin: true,
			},
		},
	},
})
