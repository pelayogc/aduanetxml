import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AduanetXML",
  description: "Expedientes aduaneros desde factura NA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">AduanetXML</Link>
            <nav className="nav">
              <Link href="/">Expedientes</Link>
              <Link href="/pendientes">Pendientes</Link>
              <Link href="/aduanetxml">Monitor AduanetXML</Link>
              <Link href="/configuracion">Configuracion</Link>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
