import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { syncAduanetXmlNow } from "@/app/aduanetxml/actions";
import { getAduanetXmlMonitor } from "@/lib/customs/service";

export const dynamic = "force-dynamic";

function badgeClass(status: string) {
  if (status.includes("ERROR") || status.includes("RECHAZADO")) return "error";
  if (status.includes("PENDIENTE") || status.includes("PROCESO")) return "warn";
  if (status.includes("FIRMADO") || status.includes("ADMITIDO") || status.includes("LEVANTE")) return "ok";
  return "";
}

function formatDate(value: Date) {
  return value.toISOString().replace("T", " ").slice(0, 19);
}

export default async function AduanetXmlMonitorPage() {
  const monitor = await getAduanetXmlMonitor();

  return (
    <div className="grid">
      <section className="page-heading">
        <div>
          <h1>Monitor AduanetXML</h1>
          <p className="muted">Seguimiento de carpetas oficiales, envios firmados, rechazos y respuestas AEAT.</p>
        </div>
        <form action={syncAduanetXmlNow}>
          <button className="button" type="submit"><RefreshCw size={16} />Sincronizar ahora</button>
        </form>
      </section>

      <section className="metrics">
        <div className="metric"><strong>{monitor.counts.pending}</strong><span>Previo firma</span></div>
        <div className="metric"><strong>{monitor.counts.sendQueue}</strong><span>Bandeja salida</span></div>
        <div className="metric"><strong>{monitor.counts.sent}</strong><span>Enviados</span></div>
        <div className="metric"><strong>{monitor.counts.rejected}</strong><span>Rechazados</span></div>
        <div className="metric"><strong>{monitor.counts.inbox}</strong><span>Bandeja entrada</span></div>
        <div className="metric"><strong>{monitor.counts.logs}</strong><span>Logs</span></div>
      </section>

      <section className="panel">
        <h2>Expedientes en seguimiento</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Factura</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {monitor.recentFiles.map((file) => (
              <tr key={file.id}>
                <td>{file.expedienteCode}</td>
                <td>{file.documentNo}</td>
                <td><span className={`badge ${badgeClass(file.status)}`}>{file.status}</span></td>
                <td>{formatDate(file.updatedAt)}</td>
                <td><Link className="button secondary" href={`/expedientes/${file.id}`}>Abrir</Link></td>
              </tr>
            ))}
            {!monitor.recentFiles.length && <tr><td className="muted" colSpan={5}>No hay expedientes en seguimiento.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Carpetas oficiales</h2>
          {Object.entries(monitor.folders).map(([key, value]) => (
            <p key={key}><strong>{key}:</strong> <span className="muted">{value}</span></p>
          ))}
        </div>
        <div className="panel">
          <h2>Ficheros pendientes</h2>
          {[...monitor.files.pending, ...monitor.files.sendQueue, ...monitor.files.inbox].slice(0, 25).map((entry) => (
            <p key={entry.filePath}>{entry.file} <span className="muted">({entry.size} bytes)</span></p>
          ))}
          {![...monitor.files.pending, ...monitor.files.sendQueue, ...monitor.files.inbox].length && <p className="muted">No hay ficheros pendientes en bandejas.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>Ultimos logs AduanetXML</h2>
        {monitor.logSnippets.map((log) => (
          <details key={log.file} className="log-block">
            <summary>{log.file}</summary>
            <pre>{log.content || "Log vacio o no legible."}</pre>
          </details>
        ))}
        {!monitor.logSnippets.length && <p className="muted">Sin logs disponibles.</p>}
      </section>
    </div>
  );
}
