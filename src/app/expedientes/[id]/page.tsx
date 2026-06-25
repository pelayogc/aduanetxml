import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FieldLabel } from "@/app/field-label";
import { ExpedienteActions } from "@/app/expedientes/[id]/expediente-actions";
import { defaultGoodsOptions } from "@/lib/customs/goods";
import { defaultCustomsOffices } from "@/lib/customs/offices";

export const dynamic = "force-dynamic";

function badgeClass(status: string) {
  if (status.includes("ERROR")) return "error";
  if (status.includes("PENDIENTE")) return "warn";
  if (status.includes("LISTO") || status.includes("LEVANTE") || status.includes("ADMITIDO")) return "ok";
  return "";
}

function pendingFieldLabel(field: string) {
  const labels: Record<string, string> = {
    aduanaCodigoAeat: "Codigo AEAT aduana de salida/expedicion",
  };
  return labels[field] ?? field;
}

function documentLabel(type: string) {
  const labels: Record<string, string> = {
    XML_GENERADO: "XML generado",
    XML_DEPOSITADO: "XML depositado en AduanetXML",
    XML_FIRMADO_ENVIADO: "XML firmado/enviado",
    XML_RECHAZADO: "Rechazo AduanetXML",
    XML_RESPUESTA_AEAT: "Respuesta AEAT",
    JUSTIFICANTE_AEAT: "Justificante AEAT",
    LEVANTE_AEAT: "Levante AEAT",
    LOG_ADUANETXML: "Log AduanetXML",
    XML_ENVIADO: "XML enviado",
    XML_RESPUESTA: "XML respuesta",
  };
  return labels[type] ?? type;
}

function timelineStatus(done: boolean, active = false) {
  if (done) return "ok";
  if (active) return "warn";
  return "";
}

interface OfficeOption {
  normalizedText: string;
  aeatCode: string;
  officeType: string;
  notes: string;
}

interface GoodsOption {
  goodsCode: string;
  goodsDescription: string;
}

export default async function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [file, officeRows, tariffRows] = await Promise.all([
    prisma.customsFile.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        xmlSubmissions: { orderBy: { version: "desc" } },
        auditLogs: { orderBy: { eventDatetime: "desc" }, take: 30 },
      },
    }),
    prisma.customsOffice.findMany({ where: { active: true }, orderBy: { normalizedText: "asc" } }),
    prisma.tariffMapping.findMany({ where: { active: true }, orderBy: { goodsCode: "asc" } }),
  ]);
  if (!file) notFound();
  const pendingFields = Array.isArray(file.pendingFields) ? file.pendingFields.map(String) : [];
  const currentAduanaTexto = file.aduanaTexto || "";
  const currentCodigoMercancia = file.codigoMercancia || "";
  const officeOptions: OfficeOption[] = [
    ...defaultCustomsOffices,
    ...officeRows.map((office) => ({
      normalizedText: office.normalizedText,
      aeatCode: office.aeatCode,
      officeType: office.officeType || "",
      notes: office.notes || "",
    })),
  ].filter((office, index, offices) => offices.findIndex((item) => item.normalizedText === office.normalizedText) === index);
  const fileOfficeMissing = currentAduanaTexto && !officeOptions.some((office) => office.normalizedText === currentAduanaTexto);
  const actionOfficeOptions: OfficeOption[] = fileOfficeMissing
    ? [{ normalizedText: currentAduanaTexto, aeatCode: file.aduanaCodigoAeat || "", officeType: "ACTUAL", notes: "Valor actual del expediente." }, ...officeOptions]
    : officeOptions;
  const goodsOptions: GoodsOption[] = [
    ...defaultGoodsOptions,
    ...tariffRows.map((tariff) => ({ goodsCode: tariff.goodsCode, goodsDescription: tariff.goodsDescription })),
  ].filter((goods, index, allGoods) => allGoods.findIndex((item) => item.goodsCode === goods.goodsCode) === index);
  const fileGoodsMissing = currentCodigoMercancia && !goodsOptions.some((goods) => goods.goodsCode === currentCodigoMercancia);
  const actionGoodsOptions: GoodsOption[] = fileGoodsMissing
    ? [{ goodsCode: currentCodigoMercancia, goodsDescription: file.descripcionMercancia || "" }, ...goodsOptions]
    : goodsOptions;
  const documentTypes = new Set(file.documents.map((doc) => doc.documentType));
  const timeline = [
    { label: "XML generado", done: documentTypes.has("XML_GENERADO") || documentTypes.has("XML_ENVIADO") || file.status !== "LISTO_PARA_GENERAR" },
    { label: "Depositado para firma/envio", done: documentTypes.has("XML_DEPOSITADO") || ["PENDIENTE_FIRMA_ENVIO", "EN_PROCESO_ADUANETXML", "FIRMADO_ENVIADO", "RESPUESTA_RECIBIDA", "ADMITIDO", "LEVANTE_OBTENIDO"].includes(file.status), active: file.status === "PENDIENTE_FIRMA_ENVIO" },
    { label: "En proceso AduanetXML", done: ["EN_PROCESO_ADUANETXML", "FIRMADO_ENVIADO", "RESPUESTA_RECIBIDA", "ADMITIDO", "LEVANTE_OBTENIDO"].includes(file.status), active: file.status === "EN_PROCESO_ADUANETXML" },
    { label: "Firmado/enviado", done: documentTypes.has("XML_FIRMADO_ENVIADO") || ["FIRMADO_ENVIADO", "RESPUESTA_RECIBIDA", "ADMITIDO", "LEVANTE_OBTENIDO"].includes(file.status), active: file.status === "FIRMADO_ENVIADO" },
    { label: "Respuesta/levante AEAT", done: ["RESPUESTA_RECIBIDA", "ADMITIDO", "LEVANTE_OBTENIDO"].includes(file.status) || documentTypes.has("XML_RESPUESTA_AEAT"), active: ["RESPUESTA_RECIBIDA", "ADMITIDO"].includes(file.status) },
  ];

  return (
    <div className="grid">
      <section>
        <Link className="muted" href="/">Volver</Link>
        <h1>{file.expedienteCode}</h1>
        <p className="muted">Factura {file.documentNo} · {file.operationType} · <span className={`badge ${badgeClass(file.status)}`}>{file.status}</span></p>
      </section>

      <ExpedienteActions file={{
        id: file.id,
        customerVatNo: file.customerVatNo,
        customerAddress: file.customerAddress,
        customerPhone: file.customerPhone,
        customerEmail: file.customerEmail,
        numBultos: file.numBultos,
        pesoNetoKg: file.pesoNetoKg?.toString() ?? "",
        pesoBrutoKg: file.pesoBrutoKg?.toString() ?? "",
        aduanaTexto: file.aduanaTexto,
        aduanaCodigoAeat: file.aduanaCodigoAeat,
        codigoMercancia: file.codigoMercancia,
        descripcionMercancia: file.descripcionMercancia,
        partidaFacturaTexto: file.partidaFacturaTexto,
        consentimientoDestinatario: file.consentimientoDestinatario,
        transportista: file.transportista,
        tracking: file.tracking,
        tipoBulto: file.tipoBulto,
      }} officeOptions={actionOfficeOptions} goodsOptions={actionGoodsOptions} />

      {pendingFields.length > 0 && (
        <section className="panel">
          <h2>Datos pendientes</h2>
          <div className="actions">
            {pendingFields.map((field) => <span className="badge warn" key={field}>{pendingFieldLabel(field)}</span>)}
          </div>
        </section>
      )}

      <section className="grid two">
        <div className="panel">
          <h2>Factura y destinatario</h2>
          <p><strong>Fecha:</strong> {file.invoiceDate?.toISOString().slice(0, 10) || ""}</p>
          <p><strong>Cliente:</strong> {file.customerName}</p>
          <p><strong>NIF:</strong> {file.customerVatNo || ""}</p>
          <p><strong>Direccion:</strong> {file.customerAddress || ""}</p>
          <p><strong>CP/Poblacion:</strong> {file.customerPostCode || ""} {file.customerCity || ""}</p>
          <p><strong>Importe:</strong> {file.invoiceAmountIncludingVat.toString()} {file.currencyCode || "EUR"}</p>
        </div>
        <div className="panel">
          <h2>Datos aduaneros</h2>
          <p><strong>Mercancia:</strong> {file.descripcionMercancia || ""}</p>
          <p><strong>Codigo:</strong> {file.codigoMercancia || ""}</p>
          <p><strong>Partida factura:</strong> {file.partidaFacturaTexto || ""}</p>
          <p><strong>Aduana salida/expedicion:</strong> {file.aduanaTexto || ""} {file.aduanaCodigoAeat || ""}</p>
          <p><strong>Bultos/Pesos:</strong> {file.numBultos ?? ""} · {file.pesoNetoKg?.toString() || ""} / {file.pesoBrutoKg?.toString() || ""} kg</p>
          <p><strong>T2LF:</strong> {file.t2lf ? "Si" : "No"}</p>
        </div>
      </section>

      <section className="panel">
        <h2>Ciclo AduanetXML</h2>
        <div className="timeline">
          {timeline.map((item) => (
            <div className={`timeline-item ${timelineStatus(item.done, item.active)}`} key={item.label}>
              <span />
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
        {file.status === "RECHAZADO_ADUANETXML" && <p className="badge error">Revisar documento de rechazo y logs AduanetXML.</p>}
      </section>

      <section className="panel">
        <h2>Lineas de mercancia</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Linea</th>
              <th>Articulo</th>
              <th>ISBN</th>
              <th>Descripcion</th>
              <th>Cantidad</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {file.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.lineNo}</td>
                <td>{line.itemNo}</td>
                <td>{line.isbn}</td>
                <td>{line.description}</td>
                <td>{line.quantity.toString()}</td>
                <td>{line.lineAmount.toString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Documentos</h2>
          {file.documents.map((doc) => (
            <p key={doc.id}>
              {documentLabel(doc.documentType)}:{" "}
              <Link className="text-link" href={`/api/customs-files/${file.id}/documents/${doc.id}/download`}>
                {doc.filename}
              </Link>
            </p>
          ))}
          {!file.documents.length && <p className="muted">Sin documentos generados.</p>}
        </div>
        <div className="panel">
          <h2>XML</h2>
          {file.xmlSubmissions.map((xml) => <p key={xml.id}>v{xml.version} · {xml.status} · <span className="muted">{xml.xmlFilename}</span></p>)}
          {!file.xmlSubmissions.length && <p className="muted">Sin XML generado.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="field">
          <FieldLabel htmlFor="extractedCustomsText" help="Texto aduanero original leido de las lineas no mercancia de Navision. Es la evidencia usada para extraer bultos, pesos, aduana, partida y T2LF.">
            Texto aduanero extraido
          </FieldLabel>
          <textarea id="extractedCustomsText" className="textarea" readOnly value={file.extractedCustomsText || ""} />
        </div>
      </section>

      <section className="panel">
        <h2>Auditoria</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Accion</th>
              <th>Estado</th>
              <th>Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {file.auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.eventDatetime.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td>{log.action}</td>
                <td>{log.previousStatus || ""} {log.newStatus ? `-> ${log.newStatus}` : ""}</td>
                <td>{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
