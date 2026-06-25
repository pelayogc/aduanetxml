import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { CustomsFile, CustomsFileLine, DocumentType } from "@prisma/client";
import { writeStoredFile } from "@/lib/storage";

type FileWithLines = CustomsFile & { lines: CustomsFileLine[] };

async function createSimplePdf(title: string, lines: string[]) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(title, { x: 50, y: 790, size: 16, font: bold, color: rgb(0.08, 0.1, 0.12) });
  let y = 750;
  for (const line of lines) {
    page.drawText(line.slice(0, 110), { x: 50, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    if (y < 70) break;
  }
  return Buffer.from(await pdfDoc.save());
}

export async function generatePdfDocument(file: FileWithLines, documentType: DocumentType) {
  const title = {
    FACTURA_ADUANERA: "Factura aduanera",
    PACKING_LIST: "Packing list",
    PORTADA_EXPEDIENTE: "Portada expediente",
    MUESTRA_SIN_VALOR: "Muestra sin valor comercial",
    XML_GENERADO: "XML generado",
    XML_DEPOSITADO: "XML depositado en AduanetXML",
    XML_FIRMADO_ENVIADO: "XML firmado/enviado",
    XML_RECHAZADO: "XML rechazado",
    XML_RESPUESTA_AEAT: "XML respuesta AEAT",
    XML_ENVIADO: "XML enviado",
    XML_RESPUESTA: "XML respuesta",
    JUSTIFICANTE_AEAT: "Justificante AEAT",
    LEVANTE_AEAT: "Levante AEAT",
    LOG_ADUANETXML: "Log AduanetXML",
    ZIP_EXPEDIENTE: "ZIP expediente",
  }[documentType];
  const qrUrl = `${process.env.INTERNAL_BASE_URL || "https://intranet.paraninfo.es/aduanas"}/expediente/${file.expedienteCode}`;
  await QRCode.toDataURL(qrUrl);
  const body = [
    `Expediente: ${file.expedienteCode}`,
    `Factura: ${file.documentNo}`,
    `Destino: ${file.destination}`,
    `Procedimiento: ${file.procedureCode || ""}`,
    `Destinatario: ${file.customerName || ""}`,
    `NIF destinatario: ${file.customerVatNo || ""}`,
    `Importe: ${file.invoiceAmountIncludingVat.toString()} ${file.currencyCode || "EUR"}`,
    `Mercancia: ${file.descripcionMercancia || "LIBROS IMPRESOS"}`,
    `Partida: ${file.codigoMercancia || ""}`,
    `Bultos: ${file.numBultos ?? ""}`,
    `Peso neto: ${file.pesoNetoKg?.toString() ?? ""}`,
    `Peso bruto: ${file.pesoBrutoKg?.toString() ?? ""}`,
    `Aduana: ${file.aduanaTexto || ""} ${file.aduanaCodigoAeat || ""}`,
    `Transportista: ${file.transportista || ""}`,
    `Tracking: ${file.tracking || ""}`,
    `QR interno: ${qrUrl}`,
    "",
    "Lineas:",
    ...file.lines.map((line) => `${line.itemNo || ""} ${line.isbn || ""} ${line.description || ""} x ${line.quantity.toString()} = ${line.lineAmount.toString()}`),
  ];
  const filename = `${file.expedienteCode}_${documentType.toLowerCase()}.pdf`;
  const pdf = await createSimplePdf(title, body);
  const filePath = await writeStoredFile(["documents", file.expedienteCode], filename, pdf);
  return { filename, path: filePath };
}
