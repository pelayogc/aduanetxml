import Link from "next/link";
import { FilePlus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FieldLabel } from "@/app/field-label";
import { SubmitInvoiceForm } from "@/app/submit-invoice-form";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status.includes("ERROR")) return "error";
  if (status.includes("PENDIENTE")) return "warn";
  if (status.includes("LISTO") || status.includes("LEVANTE") || status.includes("ADMITIDO")) return "ok";
  return "";
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  let databaseError: string | null = null;
  const files = await prisma.customsFile.findMany({
      where: {
        documentNo: params.q ? { contains: params.q, mode: "insensitive" } : undefined,
        status: params.status ? params.status as never : undefined,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })
    .catch((error: unknown) => {
      databaseError = error instanceof Error ? error.message : "No se pudo consultar la base de datos.";
      return [];
    });

  return (
    <div className="grid">
      <section>
        <h1>Expedientes aduaneros</h1>
        <p className="muted">Filtra expedientes ya creados o consulta Navision para crear uno nuevo.</p>
      </section>

      <section className="panel">
        {databaseError && <p className="badge warn">Base de datos no configurada: {databaseError}</p>}
        <form className="toolbar" action="/">
          <div className="field">
            <FieldLabel htmlFor="q" help="Busca solo entre expedientes ya creados en esta aplicacion. No consulta Navision ni crea un expediente nuevo.">
              Filtrar expedientes existentes
            </FieldLabel>
            <input id="q" className="input" name="q" defaultValue={params.q || ""} placeholder="NA-0718435" />
          </div>
          <button className="button secondary" type="submit"><Search size={16} />Filtrar</button>
        </form>
        <SubmitInvoiceForm />
      </section>

      <section className="panel">
        <h2>Ultimos expedientes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Factura</th>
              <th>Destino</th>
              <th>Estado</th>
              <th>Cliente</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.expedienteCode}</td>
                <td>{file.documentNo}</td>
                <td>{file.destination}</td>
                <td><span className={`badge ${statusClass(file.status)}`}>{file.status}</span></td>
                <td>{file.customerName}</td>
                <td><Link className="button secondary" href={`/expedientes/${file.id}`}><FilePlus size={16} />Abrir</Link></td>
              </tr>
            ))}
            {!files.length && (
              <tr>
                <td colSpan={6} className="muted">No hay expedientes todavia.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
