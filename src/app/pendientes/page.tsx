import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PendientesPage() {
  let databaseError: string | null = null;
  const files = await prisma.customsFile.findMany({
      where: { status: { in: ["PENDIENTE_DATOS", "RECHAZADO_ADUANETXML", "ERROR_AEAT", "ERROR_TECNICO", "PENDIENTE_REGENERAR_XML"] } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    })
    .catch((error: unknown) => {
      databaseError = error instanceof Error ? error.message : "No se pudo consultar la base de datos.";
      return [];
    });

  return (
    <div className="grid">
      <section>
        <h1>Bandeja de pendientes</h1>
        <p className="muted">Expedientes que necesitan datos, correccion o regeneracion.</p>
        {databaseError && <p className="badge warn">Base de datos no configurada: {databaseError}</p>}
      </section>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Factura</th>
              <th>Estado</th>
              <th>Pendientes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const pending = Array.isArray(file.pendingFields) ? file.pendingFields.map(String).join(", ") : "";
              return (
                <tr key={file.id}>
                  <td>{file.expedienteCode}</td>
                  <td>{file.documentNo}</td>
                  <td><span className="badge warn">{file.status}</span></td>
                  <td>{pending}</td>
                  <td><Link className="button secondary" href={`/expedientes/${file.id}`}>Corregir</Link></td>
                </tr>
              );
            })}
            {!files.length && <tr><td colSpan={5} className="muted">No hay expedientes pendientes.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
