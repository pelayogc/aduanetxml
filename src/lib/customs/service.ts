import path from "node:path";
import { Prisma, type CustomsFileStatus, type DocumentType, type XmlSubmissionStatus } from "@prisma/client";
import { defaultProcedure, classifyDestination, classifyOperation } from "@/lib/customs/classification";
import { isBooksTariff, normalizeTariff, normalizeText } from "@/lib/customs/normalize";
import { generatePdfDocument } from "@/lib/customs/documents";
import { findDefaultCustomsOffice } from "@/lib/customs/offices";
import { parseCustomsText } from "@/lib/customs/parser";
import { buildCustomsXml, extractResponseFields } from "@/lib/customs/xml";
import { validateCustomsFile } from "@/lib/customs/validation";
import { getNavInvoiceByDocumentNo } from "@/lib/navision/invoices";
import { prisma } from "@/lib/prisma";
import { configuredFolder, copyToConfiguredFolder, listConfiguredFolder, moveToConfiguredFolder, readStoredBuffer, readStoredText, writeStoredFile } from "@/lib/storage";

function expedienteCode(documentNo: string, postingDate?: string | null) {
  const year = postingDate ? postingDate.slice(0, 4) : new Date().getFullYear().toString();
  return `EXP-NA-${year}-${documentNo.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

function dateFromIso(value?: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function findOfficeCode(aduanaTexto: string | null) {
  if (!aduanaTexto) return null;
  const normalized = normalizeText(aduanaTexto);
  const office = await prisma.customsOffice.findFirst({ where: { normalizedText: normalized, active: true } });
  return office?.aeatCode ?? findDefaultCustomsOffice(aduanaTexto)?.aeatCode ?? null;
}

async function resolveTariff(partidaFacturaTexto: string | null) {
  const normalized = normalizeTariff(partidaFacturaTexto);
  if (!normalized) return { codigoMercancia: null, descripcionMercancia: null, partidaFacturaTexto: null };
  const mapping = await prisma.tariffMapping.findFirst({
    where: { normalizedTariffText: normalizeText(normalized), active: true },
  });
  if (mapping) {
    return {
      codigoMercancia: mapping.goodsCode,
      descripcionMercancia: mapping.goodsDescription,
      partidaFacturaTexto: normalized,
    };
  }
  if (isBooksTariff(normalized)) {
    return { codigoMercancia: "49019900", descripcionMercancia: "LIBROS IMPRESOS", partidaFacturaTexto: normalized };
  }
  return { codigoMercancia: null, descripcionMercancia: null, partidaFacturaTexto: normalized };
}

async function audit(customsFileId: string, action: string, message?: string, previousStatus?: CustomsFileStatus | null, newStatus?: CustomsFileStatus | null) {
  await prisma.customsAuditLog.create({
    data: {
      customsFileId,
      action,
      message,
      previousStatus: previousStatus ?? undefined,
      newStatus: newStatus ?? undefined,
      origin: "app",
    },
  });
}

async function registerDocument(customsFileId: string, documentType: DocumentType, filename: string, filePath: string) {
  const existing = await prisma.customsDocument.findFirst({
    where: { customsFileId, documentType, filename, path: filePath },
  });
  if (existing) return existing;
  return prisma.customsDocument.create({
    data: { customsFileId, documentType, filename, path: filePath },
  });
}

async function archiveConfiguredFile(customsFileId: string, expediente: string, sourcePath: string, folder: string, documentType: DocumentType) {
  const filename = path.basename(sourcePath);
  const content = await readStoredBuffer(sourcePath);
  const archivedPath = await writeStoredFile(["aduanetxml", "evidence", expediente, folder], filename, content);
  await registerDocument(customsFileId, documentType, filename, archivedPath);
  return archivedPath;
}

function expedienteFromText(value: string) {
  return value.match(/EXP-NA-[A-Za-z0-9_-]+/)?.[0] ?? null;
}

async function expedienteFromFile(file: string, filePath: string) {
  const fromName = expedienteFromText(file);
  if (fromName) return fromName;
  if (!file.toLowerCase().endsWith(".xml")) return null;
  try {
    return expedienteFromText(await readStoredText(filePath));
  } catch {
    return null;
  }
}

function rejectionMessage(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  const xmlError = extractResponseFields(text);
  return xmlError.errorMessage || compact.slice(0, 700) || "Fichero rechazado por AduanetXML sin detalle legible.";
}

export async function createCustomsFileFromInvoice(documentNo: string) {
  const existing = await prisma.customsFile.findUnique({
    where: { documentNo },
    include: { lines: { orderBy: { lineNo: "asc" } }, documents: true, xmlSubmissions: true, auditLogs: { orderBy: { eventDatetime: "desc" }, take: 20 } },
  });
  if (existing) return existing;

  const invoice = await getNavInvoiceByDocumentNo(documentNo);
  if (!invoice) throw new Error(`Factura ${documentNo} no encontrada en Navision.`);

  const parsed = parseCustomsText(invoice.customsText);
  const destination = classifyDestination({
    postCode: invoice.header.customerPostCode,
    province: invoice.header.customerProvince,
    city: invoice.header.customerCity,
    countryRegionCode: invoice.header.customerCountryRegionCode,
    address: [invoice.header.customerAddress, invoice.header.customerAddress2].filter(Boolean).join(" "),
  });
  const operationType = classifyOperation({
    documentNo: invoice.header.documentNo,
    customerName: invoice.header.customerName,
    invoiceAmount: invoice.header.totalAmountIncludingVat,
    postCode: invoice.header.customerPostCode,
    province: invoice.header.customerProvince,
    city: invoice.header.customerCity,
    countryRegionCode: invoice.header.customerCountryRegionCode,
    address: invoice.header.customerAddress,
  });
  const procedure = defaultProcedure(operationType);
  const tariff = await resolveTariff(parsed.partidaFacturaTexto);
  const aduanaCodigoAeat = await findOfficeCode(parsed.aduanaTexto);
  const validation = validateCustomsFile({
    documentNo,
    operationType,
    destination,
    customerName: invoice.header.customerName,
    customerVatNo: invoice.header.customerVatNo,
    customerAddress: invoice.header.customerAddress,
    invoiceAmount: invoice.header.totalAmountIncludingVat,
    currencyCode: invoice.header.currencyCode,
    numBultos: parsed.numBultos,
    pesoNetoKg: parsed.pesoNetoKg,
    pesoBrutoKg: parsed.pesoBrutoKg,
    aduanaCodigoAeat,
    codigoMercancia: tariff.codigoMercancia,
    partidaFacturaTexto: tariff.partidaFacturaTexto,
    t2lf: parsed.t2lfIndicado,
    productLineCount: invoice.productLines.length,
    procedure,
  });

  const created = await prisma.customsFile.create({
    data: {
      expedienteCode: expedienteCode(documentNo, invoice.header.postingDate),
      documentNo,
      operationType,
      destination,
      status: validation.status,
      customerNo: invoice.header.billToCustomerNo,
      customerName: invoice.header.customerName,
      customerVatNo: invoice.header.customerVatNo,
      customerAddress: [invoice.header.customerAddress, invoice.header.customerAddress2].filter(Boolean).join(" "),
      customerPostCode: invoice.header.customerPostCode,
      customerCity: invoice.header.customerCity,
      customerProvince: invoice.header.customerProvince,
      customerCountryRegionCode: invoice.header.customerCountryRegionCode,
      customerPhone: invoice.header.customerPhone,
      customerEmail: invoice.header.customerEmail,
      invoiceDate: dateFromIso(invoice.header.postingDate),
      invoiceAmount: new Prisma.Decimal(invoice.header.totalAmount),
      invoiceAmountIncludingVat: new Prisma.Decimal(invoice.header.totalAmountIncludingVat),
      currencyCode: invoice.header.currencyCode || "EUR",
      numBultos: parsed.numBultos,
      pesoNetoKg: parsed.pesoNetoKg === null ? null : new Prisma.Decimal(parsed.pesoNetoKg),
      pesoBrutoKg: parsed.pesoBrutoKg === null ? null : new Prisma.Decimal(parsed.pesoBrutoKg),
      aduanaTexto: parsed.aduanaTexto,
      aduanaCodigoAeat,
      codigoMercancia: tariff.codigoMercancia,
      descripcionMercancia: tariff.descripcionMercancia || parsed.descripcionMercancia,
      partidaFacturaTexto: tariff.partidaFacturaTexto,
      paisOrigen: "ES",
      t2lf: parsed.t2lfIndicado,
      sinSoporteMagnetico: parsed.sinSoporteMagnetico,
      procedureCode: procedure.procedureCode,
      declarationCode: procedure.declarationCode,
      destinationCode: procedure.destinationCode,
      customsRegime: procedure.customsRegime,
      pendingFields: validation.pendingFields,
      extractedCustomsText: invoice.customsText,
      lines: {
        create: invoice.productLines.map((line) => ({
          documentNo,
          lineNo: line.lineNo,
          navType: line.type,
          itemNo: line.no,
          isbn: line.isbn,
          description: [line.description, line.description2].filter(Boolean).join(" "),
          quantity: new Prisma.Decimal(line.quantity),
          unitPrice: new Prisma.Decimal(line.unitPrice),
          lineAmount: new Prisma.Decimal(line.lineAmount),
          amountInclVat: new Prisma.Decimal(line.amountIncludingVat),
          vatPercent: line.vatPercent === null ? null : new Prisma.Decimal(line.vatPercent),
          taricCode: tariff.codigoMercancia,
          countryOrigin: "ES",
          netWeightKg: line.netWeightKg === null ? null : new Prisma.Decimal(line.netWeightKg),
          grossWeightKg: line.grossWeightKg === null ? null : new Prisma.Decimal(line.grossWeightKg),
        })),
      },
    },
    include: { lines: { orderBy: { lineNo: "asc" } }, documents: true, xmlSubmissions: true, auditLogs: { orderBy: { eventDatetime: "desc" }, take: 20 } },
  });
  await audit(created.id, "CREACION_EXPEDIENTE", `Expediente creado desde factura ${documentNo}`, null, created.status);
  return created;
}

export async function validateAndUpdateCustomsFile(id: string) {
  const file = await prisma.customsFile.findUnique({ where: { id }, include: { lines: true } });
  if (!file) throw new Error("Expediente no encontrado.");
  const resolvedAduanaCodigoAeat = file.aduanaCodigoAeat ?? await findOfficeCode(file.aduanaTexto);
  const fileForValidation = resolvedAduanaCodigoAeat && resolvedAduanaCodigoAeat !== file.aduanaCodigoAeat
    ? await prisma.customsFile.update({ where: { id }, data: { aduanaCodigoAeat: resolvedAduanaCodigoAeat }, include: { lines: true } })
    : file;
  const procedure = defaultProcedure(file.operationType);
  const result = validateCustomsFile({
    documentNo: fileForValidation.documentNo,
    operationType: fileForValidation.operationType,
    destination: fileForValidation.destination,
    customerName: fileForValidation.customerName,
    customerVatNo: fileForValidation.customerVatNo,
    customerAddress: fileForValidation.customerAddress,
    invoiceAmount: Number(fileForValidation.invoiceAmountIncludingVat),
    currencyCode: fileForValidation.currencyCode,
    numBultos: fileForValidation.numBultos,
    pesoNetoKg: fileForValidation.pesoNetoKg ? Number(fileForValidation.pesoNetoKg) : null,
    pesoBrutoKg: fileForValidation.pesoBrutoKg ? Number(fileForValidation.pesoBrutoKg) : null,
    aduanaCodigoAeat: fileForValidation.aduanaCodigoAeat,
    codigoMercancia: fileForValidation.codigoMercancia,
    partidaFacturaTexto: fileForValidation.partidaFacturaTexto,
    t2lf: fileForValidation.t2lf,
    transportista: fileForValidation.transportista,
    tracking: fileForValidation.tracking,
    consentimientoDestinatario: fileForValidation.consentimientoDestinatario,
    productLineCount: fileForValidation.lines.length,
    procedure,
  });
  const updated = await prisma.customsFile.update({
    where: { id },
    data: { status: result.status, pendingFields: result.pendingFields },
    include: { lines: { orderBy: { lineNo: "asc" } }, documents: true, xmlSubmissions: true, auditLogs: { orderBy: { eventDatetime: "desc" }, take: 20 } },
  });
  const mappedMessage = resolvedAduanaCodigoAeat && resolvedAduanaCodigoAeat !== file.aduanaCodigoAeat ? `Aduana de salida mapeada a ${resolvedAduanaCodigoAeat}. ` : "";
  await audit(id, "VALIDACION", `${mappedMessage}${result.issues.map((issue) => issue.message).join(" | ") || "Expediente validado"}`, file.status, updated.status);
  return { file: updated, validation: result };
}

export async function generateCustomsDocuments(id: string) {
  const file = await prisma.customsFile.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } } } });
  if (!file) throw new Error("Expediente no encontrado.");
  const types: DocumentType[] = file.operationType === "MUESTRA_PROFESOR"
    ? ["MUESTRA_SIN_VALOR"]
    : ["FACTURA_ADUANERA", "PACKING_LIST", "PORTADA_EXPEDIENTE"];
  const documents = [];
  for (const documentType of types) {
    const generated = await generatePdfDocument(file, documentType);
    documents.push(await prisma.customsDocument.create({
      data: { customsFileId: id, documentType, filename: generated.filename, path: generated.path },
    }));
  }
  await audit(id, "GENERACION_DOCUMENTOS", `${documents.length} documentos generados`);
  return documents;
}

export async function generateCustomsXml(id: string) {
  const { file } = await validateAndUpdateCustomsFile(id);
  if (file.status !== "LISTO_PARA_GENERAR") throw new Error("El expediente no esta listo para generar XML.");
  const fullFile = await prisma.customsFile.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } }, xmlSubmissions: true } });
  if (!fullFile) throw new Error("Expediente no encontrado.");
  const version = (fullFile.xmlSubmissions.reduce((max, submission) => Math.max(max, submission.version), 0) || 0) + 1;
  const procedure = fullFile.procedureCode || "SIN_PROCEDIMIENTO";
  const filename = `${fullFile.expedienteCode}_${procedure}_v${version}.xml`;
  const xml = buildCustomsXml(fullFile, version);
  const filePath = await writeStoredFile(["xml", fullFile.expedienteCode], filename, xml);
  const submission = await prisma.customsXmlSubmission.create({
    data: {
      customsFileId: id,
      version,
      procedureCode: procedure,
      xmlFilename: filename,
      xmlPath: filePath,
      status: "GENERATED",
    },
  });
  await registerDocument(id, "XML_GENERADO", filename, filePath);
  const previousStatus = fullFile.status;
  await prisma.customsFile.update({ where: { id }, data: { status: "XML_GENERADO" } });
  await audit(id, "GENERACION_XML", `XML ${filename} generado`, previousStatus, "XML_GENERADO");
  return submission;
}

export async function sendLatestXmlToAduanetXml(id: string) {
  const file = await prisma.customsFile.findUnique({ where: { id }, include: { xmlSubmissions: { orderBy: { version: "desc" }, take: 1 } } });
  if (!file) throw new Error("Expediente no encontrado.");
  const latest = file.xmlSubmissions[0];
  if (!latest) throw new Error("No hay XML generado.");
  const targetPath = await copyToConfiguredFolder(latest.xmlPath, "ADUANETXML_OUTBOX");
  const now = new Date();
  await registerDocument(id, "XML_DEPOSITADO", path.basename(targetPath), targetPath);
  await prisma.customsXmlSubmission.update({
    where: { id: latest.id },
    data: { status: "DEPOSITED", sentAt: now },
  });
  await prisma.customsFile.update({ where: { id }, data: { status: "PENDIENTE_FIRMA_ENVIO" } });
  await audit(id, "DEPOSITO_ADUANETXML", `XML depositado para firma/envio en ${targetPath}`, file.status, "PENDIENTE_FIRMA_ENVIO");
  return { targetPath };
}

export async function syncAduanetXmlFolders() {
  const processed: Array<{ file: string; folder: string; status: string }> = [];
  const sentEntries = await listConfiguredFolder("ADUANETXML_SENT");
  for (const entry of sentEntries) {
    const expediente = await expedienteFromFile(entry.file, entry.filePath);
    if (!expediente) {
      processed.push({ file: entry.file, folder: "Enviados", status: "unmatched" });
      continue;
    }
    const customsFile = await prisma.customsFile.findUnique({ where: { expedienteCode: expediente }, include: { xmlSubmissions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!customsFile) {
      processed.push({ file: entry.file, folder: "Enviados", status: "unknown_file" });
      continue;
    }
    const archivedPath = await archiveConfiguredFile(customsFile.id, expediente, entry.filePath, "enviados", "XML_FIRMADO_ENVIADO");
    const submission = customsFile.xmlSubmissions[0];
    if (submission && !["SIGNED_SENT", "RESPONSE_RECEIVED"].includes(submission.status)) {
      await prisma.customsXmlSubmission.update({ where: { id: submission.id }, data: { status: "SIGNED_SENT" } });
    }
    if (!["RESPUESTA_RECIBIDA", "ADMITIDO", "LEVANTE_OBTENIDO"].includes(customsFile.status)) {
      await prisma.customsFile.update({ where: { id: customsFile.id }, data: { status: "FIRMADO_ENVIADO" } });
      await audit(customsFile.id, "FIRMADO_ENVIADO_ADUANETXML", `Documento firmado/enviado archivado desde ${archivedPath}`, customsFile.status, "FIRMADO_ENVIADO");
    }
    processed.push({ file: entry.file, folder: "Enviados", status: "FIRMADO_ENVIADO" });
  }

  const rejectedEntries = await listConfiguredFolder("ADUANETXML_REJECTED");
  for (const entry of rejectedEntries) {
    const expediente = await expedienteFromFile(entry.file, entry.filePath);
    if (!expediente) {
      processed.push({ file: entry.file, folder: "Rechazados", status: "unmatched" });
      continue;
    }
    const customsFile = await prisma.customsFile.findUnique({ where: { expedienteCode: expediente }, include: { xmlSubmissions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!customsFile) {
      processed.push({ file: entry.file, folder: "Rechazados", status: "unknown_file" });
      continue;
    }
    const text = await readStoredText(entry.filePath).catch(() => "");
    const message = rejectionMessage(text);
    const archivedPath = await archiveConfiguredFile(customsFile.id, expediente, entry.filePath, "rechazados", "XML_RECHAZADO");
    const submission = customsFile.xmlSubmissions[0];
    if (submission) {
      await prisma.customsXmlSubmission.update({
        where: { id: submission.id },
        data: { status: "REJECTED_ADUANETXML", errorMessage: message },
      });
    }
    await prisma.customsFile.update({ where: { id: customsFile.id }, data: { status: "RECHAZADO_ADUANETXML" } });
    await audit(customsFile.id, "RECHAZO_ADUANETXML", `${message} | Archivo: ${archivedPath}`, customsFile.status, "RECHAZADO_ADUANETXML");
    processed.push({ file: entry.file, folder: "Rechazados", status: "RECHAZADO_ADUANETXML" });
  }

  const inProcessEntries = [
    ...(await listConfiguredFolder("ADUANETXML_OUTBOX")).map((entry) => ({ ...entry, folder: "BandejaSalidaPrevioFirma" })),
    ...(await listConfiguredFolder("ADUANETXML_SEND_OUTBOX")).map((entry) => ({ ...entry, folder: "BandejaSalida" })),
  ];
  for (const entry of inProcessEntries) {
    const expediente = await expedienteFromFile(entry.file, entry.filePath);
    if (!expediente) continue;
    const customsFile = await prisma.customsFile.findUnique({ where: { expedienteCode: expediente }, include: { xmlSubmissions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!customsFile || !["PENDIENTE_FIRMA_ENVIO", "XML_GENERADO", "ENVIADO_ADUANETXML"].includes(customsFile.status)) continue;
    const newStatus: CustomsFileStatus = entry.folder === "BandejaSalida" ? "EN_PROCESO_ADUANETXML" : "PENDIENTE_FIRMA_ENVIO";
    const submission = customsFile.xmlSubmissions[0];
    if (submission && submission.status !== "SIGNED_SENT") {
      await prisma.customsXmlSubmission.update({ where: { id: submission.id }, data: { status: entry.folder === "BandejaSalida" ? "IN_PROCESS" : "DEPOSITED" } });
    }
    if (customsFile.status !== newStatus) {
      await prisma.customsFile.update({ where: { id: customsFile.id }, data: { status: newStatus } });
      await audit(customsFile.id, "SEGUIMIENTO_ADUANETXML", `Fichero detectado en ${entry.folder}`, customsFile.status, newStatus);
    }
    processed.push({ file: entry.file, folder: entry.folder, status: newStatus });
  }

  processed.push(...await processAduanetXmlResponses());
  return processed;
}

export async function processAduanetXmlResponses() {
  const entries = await listConfiguredFolder("ADUANETXML_INBOX");
  const processed: Array<{ file: string; folder: string; status: string }> = [];
  for (const entry of entries.filter((item) => item.file.toLowerCase().endsWith(".xml"))) {
    const xml = await readStoredText(entry.filePath);
    const codeMatch = xml.match(/EXP-NA-[A-Za-z0-9_-]+/);
    if (!codeMatch) {
      await moveToConfiguredFolder(entry.filePath, "ADUANETXML_ERRORS");
      processed.push({ file: entry.file, folder: "BandejaEntrada", status: "unmatched" });
      continue;
    }
    const customsFile = await prisma.customsFile.findUnique({ where: { expedienteCode: codeMatch[0] }, include: { xmlSubmissions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!customsFile) {
      await moveToConfiguredFolder(entry.filePath, "ADUANETXML_ERRORS");
      processed.push({ file: entry.file, folder: "BandejaEntrada", status: "unknown_file" });
      continue;
    }
    const fields = extractResponseFields(xml);
    const archivedPath = await writeStoredFile(["aduanetxml", "evidence", customsFile.expedienteCode, "respuestas"], entry.file, xml);
    const submission = customsFile.xmlSubmissions[0];
    const submissionStatus: XmlSubmissionStatus = fields.errorCode ? "ERROR_AEAT" : "RESPONSE_RECEIVED";
    if (submission) {
      await prisma.customsXmlSubmission.update({
        where: { id: submission.id },
        data: {
          status: submissionStatus,
          responseReceivedAt: new Date(),
          responseFilename: entry.file,
          responsePath: archivedPath,
          errorCode: fields.errorCode,
          errorMessage: fields.errorMessage,
        },
      });
    }
    await registerDocument(customsFile.id, "XML_RESPUESTA_AEAT", entry.file, archivedPath);
    if (fields.csv) await registerDocument(customsFile.id, "JUSTIFICANTE_AEAT", entry.file, archivedPath);
    if (fields.levante) await registerDocument(customsFile.id, "LEVANTE_AEAT", entry.file, archivedPath);
    const newStatus: CustomsFileStatus = fields.errorCode ? "ERROR_AEAT" : fields.levante ? "LEVANTE_OBTENIDO" : fields.accepted ? "ADMITIDO" : "RESPUESTA_RECIBIDA";
    await prisma.customsFile.update({
      where: { id: customsFile.id },
      data: {
        status: newStatus,
        mrn: fields.mrn,
        csv: fields.csv,
        levante: fields.levante,
        circuito: fields.circuito,
      },
    });
    await audit(customsFile.id, "RECEPCION_RESPUESTA", fields.errorMessage || `Respuesta ${entry.file} procesada`, customsFile.status, newStatus);
    await moveToConfiguredFolder(entry.filePath, "ADUANETXML_PROCESSED");
    processed.push({ file: entry.file, folder: "BandejaEntrada", status: newStatus });
  }
  return processed;
}

export async function getAduanetXmlMonitor() {
  const [
    pending,
    sendQueue,
    sent,
    rejected,
    inbox,
    processed,
    logs,
    recentFiles,
  ] = await Promise.all([
    listConfiguredFolder("ADUANETXML_OUTBOX"),
    listConfiguredFolder("ADUANETXML_SEND_OUTBOX"),
    listConfiguredFolder("ADUANETXML_SENT"),
    listConfiguredFolder("ADUANETXML_REJECTED"),
    listConfiguredFolder("ADUANETXML_INBOX"),
    listConfiguredFolder("ADUANETXML_PROCESSED"),
    listConfiguredFolder("ADUANETXML_LOGS"),
    prisma.customsFile.findMany({
      where: { status: { in: ["PENDIENTE_FIRMA_ENVIO", "EN_PROCESO_ADUANETXML", "FIRMADO_ENVIADO", "RECHAZADO_ADUANETXML", "RESPUESTA_RECIBIDA", "ADMITIDO", "LEVANTE_OBTENIDO", "ERROR_AEAT"] } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, expedienteCode: true, documentNo: true, status: true, updatedAt: true },
    }),
  ]);
  const logSnippets = await Promise.all(logs.slice(-5).map(async (entry) => ({
    file: entry.file,
    content: (await readStoredText(entry.filePath).catch(() => "")).split(/\r?\n/).slice(-15).join("\n"),
  })));
  return {
    folders: {
      outbox: configuredFolder("ADUANETXML_OUTBOX"),
      sendOutbox: configuredFolder("ADUANETXML_SEND_OUTBOX"),
      sent: configuredFolder("ADUANETXML_SENT"),
      rejected: configuredFolder("ADUANETXML_REJECTED"),
      inbox: configuredFolder("ADUANETXML_INBOX"),
      processed: configuredFolder("ADUANETXML_PROCESSED"),
      logs: configuredFolder("ADUANETXML_LOGS"),
    },
    counts: {
      pending: pending.length,
      sendQueue: sendQueue.length,
      sent: sent.length,
      rejected: rejected.length,
      inbox: inbox.length,
      processed: processed.length,
      logs: logs.length,
    },
    files: { pending, sendQueue, sent, rejected, inbox },
    logSnippets,
    recentFiles,
  };
}

export async function updateCustomsFile(id: string, data: Record<string, unknown>) {
  const current = await prisma.customsFile.findUnique({ where: { id } });
  if (!current) throw new Error("Expediente no encontrado.");
  const text = (key: string) => {
    if (!(key in data)) return undefined;
    const value = String(data[key] ?? "").trim();
    return value || null;
  };
  const decimal = (key: string) => {
    if (!(key in data)) return undefined;
    const value = String(data[key] ?? "").replace(",", ".").trim();
    return value ? new Prisma.Decimal(value) : null;
  };
  const integer = (key: string) => {
    if (!(key in data)) return undefined;
    const value = String(data[key] ?? "").trim();
    return value ? Number(value) : null;
  };
  const aduanaTexto = text("aduanaTexto");
  const manualAduanaCodigoAeat = text("aduanaCodigoAeat");
  const resolvedAduanaCodigoAeat = manualAduanaCodigoAeat ?? (aduanaTexto === undefined ? undefined : await findOfficeCode(aduanaTexto));
  const mutable = {
    customerVatNo: text("customerVatNo"),
    customerAddress: text("customerAddress"),
    customerPhone: text("customerPhone"),
    customerEmail: text("customerEmail"),
    numBultos: integer("numBultos"),
    pesoNetoKg: decimal("pesoNetoKg"),
    pesoBrutoKg: decimal("pesoBrutoKg"),
    aduanaTexto,
    aduanaCodigoAeat: resolvedAduanaCodigoAeat,
    codigoMercancia: text("codigoMercancia"),
    descripcionMercancia: text("descripcionMercancia"),
    partidaFacturaTexto: text("partidaFacturaTexto"),
    consentimientoDestinatario: "consentimientoDestinatario" in data ? data.consentimientoDestinatario === true || data.consentimientoDestinatario === "true" : undefined,
    transportista: text("transportista"),
    tracking: text("tracking"),
    tipoBulto: text("tipoBulto"),
  };
  const updated = await prisma.customsFile.update({
    where: { id },
    data: mutable,
    include: { lines: { orderBy: { lineNo: "asc" } }, documents: true, xmlSubmissions: true, auditLogs: { orderBy: { eventDatetime: "desc" }, take: 20 } },
  });
  const hasGeneratedXml = await prisma.customsXmlSubmission.count({ where: { customsFileId: id } });
  if (hasGeneratedXml && ["XML_GENERADO", "ENVIADO_ADUANETXML", "RESPUESTA_RECIBIDA"].includes(current.status)) {
    await prisma.customsFile.update({ where: { id }, data: { status: "PENDIENTE_REGENERAR_XML" } });
  }
  await audit(id, "MODIFICACION_MANUAL", "Datos manuales actualizados", current.status, updated.status);
  return updated;
}

export function xmlFilenameFromPath(filePath: string) {
  return path.basename(filePath);
}
