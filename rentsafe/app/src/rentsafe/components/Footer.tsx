/**
 * Site footer: brand blurb, links to every category, help pages
 * ("Cómo funciona", legal), the registry contract on the block explorer and
 * the testnet disclaimer. Purely presentational.
 */
import { Link } from "react-router-dom"
import { explorerUrl } from "../../trustless/config"
import { CATEGORIES } from "../categories"
import { registryContractId } from "../chain/registry"
import styles from "./Footer.module.css"
import { Logo } from "./Header"

export const Footer = () => (
	<footer className={styles.footer}>
		<div className={`rs-container ${styles.grid}`}>
			<div className={styles.brand}>
				<Logo />
				<p className="small muted">
					Alquila lo que necesitas a personas y empresas. El alquiler y el
					depósito quedan en un escrow en Stellar hasta que ambas partes
					cumplen.
				</p>
				<p className="small muted">
					Demo en Stellar testnet. Ningún pago usa dinero real.
				</p>
			</div>
			<nav aria-label="Explorar">
				<h4>Explorar</h4>
				{CATEGORIES.map((c) => (
					<Link key={c.id} to={`/c/${c.id}`}>
						{c.label}
					</Link>
				))}
			</nav>
			<nav aria-label="RentSafe">
				<h4>RentSafe</h4>
				<Link to="/como-funciona">Cómo funciona</Link>
				<Link to="/como-funciona#proteccion">Protección del depósito</Link>
				<Link to="/propietario/publicar">Publicar un bien</Link>
				{registryContractId && (
					<a
						href={explorerUrl(registryContractId)}
						target="_blank"
						rel="noreferrer"
					>
						Contrato en Stellar
					</a>
				)}
			</nav>
			<nav aria-label="Legal">
				<h4>Legal</h4>
				<Link to="/legal/terminos">Términos de uso</Link>
				<Link to="/legal/privacidad">Privacidad</Link>
				<Link to="/legal/cancelaciones">Cancelaciones y disputas</Link>
			</nav>
		</div>
		<div className={`rs-container ${styles.bottom}`}>
			<span>© {new Date().getFullYear()} RentSafe · prototipo</span>
			<span>
				Construido sobre{" "}
				<a
					href="https://developers.stellar.org"
					target="_blank"
					rel="noreferrer"
				>
					Stellar
				</a>
				,{" "}
				<a
					href="https://docs.trustlesswork.com"
					target="_blank"
					rel="noreferrer"
				>
					Trustless Work
				</a>{" "}
				y{" "}
				<a href="https://docs.cavos.xyz" target="_blank" rel="noreferrer">
					Cavos
				</a>
			</span>
		</div>
	</footer>
)
