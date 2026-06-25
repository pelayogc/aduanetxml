import type { CustomsValidationInput, ValidationIssue, ValidationResult } from "@/lib/customs/types";

function issue(field: string, message: string): ValidationIssue {
  return { field, message };
}

export function validateCustomsFile(input: CustomsValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const sale = input.operationType.startsWith("VENTA_");
  const requiresXml = input.procedure.requiresXml;

  if (!input.documentNo) issues.push(issue("documentNo", "La factura NA es obligatoria."));
  if (input.destination === "DESCONOCIDO" || input.destination === "PENINSULA") issues.push(issue("destination", "El destino debe ser Canarias, Ceuta o Melilla."));
  if (input.operationType === "NO_ADUANERO") issues.push(issue("operationType", "El expediente no esta clasificado como operacion aduanera."));
  if (!input.customerName || !input.customerAddress) issues.push(issue("recipient", "El destinatario debe tener nombre y direccion completos."));
  if (input.procedure.requiresRecipientVat && !input.customerVatNo) issues.push(issue("customerVatNo", "El NIF/CIF del destinatario es obligatorio para este procedimiento."));
  if (sale && Number(input.invoiceAmount ?? 0) <= 0) issues.push(issue("invoiceAmount", "El importe debe ser mayor que cero en ventas."));
  if (input.currencyCode && input.currencyCode !== "EUR") issues.push(issue("currencyCode", "La moneda debe ser EUR o estar convertida."));
  if (!input.numBultos || input.numBultos <= 0) issues.push(issue("numBultos", "Los bultos deben ser un entero mayor que cero."));
  if (!input.pesoNetoKg || input.pesoNetoKg <= 0) issues.push(issue("pesoNetoKg", "El peso neto debe ser mayor que cero."));
  if (!input.pesoBrutoKg || input.pesoBrutoKg <= 0) issues.push(issue("pesoBrutoKg", "El peso bruto debe ser mayor que cero."));
  if (input.pesoNetoKg && input.pesoBrutoKg && input.pesoBrutoKg < input.pesoNetoKg) issues.push(issue("pesoBrutoKg", "El peso bruto debe ser mayor o igual que el peso neto."));
  if (!input.aduanaCodigoAeat && requiresXml) issues.push(issue("aduanaCodigoAeat", "La aduana de salida/expedicion debe mapear a codigo AEAT."));
  if (!input.codigoMercancia && requiresXml) issues.push(issue("codigoMercancia", "El codigo de mercancia debe estar informado."));
  if (!input.partidaFacturaTexto && requiresXml) issues.push(issue("partidaFacturaTexto", "La partida arancelaria debe estar normalizada."));
  if (input.procedure.requiresT2lf && !input.t2lf) issues.push(issue("t2lf", "El T2LF es obligatorio para este procedimiento."));
  if (input.procedure.requiresConsent && !input.consentimientoDestinatario) issues.push(issue("consentimientoDestinatario", "El consentimiento del destinatario es obligatorio."));
  if (input.productLineCount <= 0 && sale) issues.push(issue("lines", "Debe existir al menos una linea de producto/libro."));

  const pendingFields = [...new Set(issues.map((item) => item.field))];
  if (input.operationType === "MUESTRA_PROFESOR") return { status: "NO_REQUIERE_XML", issues: [], pendingFields: [] };
  if (!requiresXml && input.operationType !== "NO_ADUANERO") return { status: "NO_REQUIERE_XML", issues: [], pendingFields: [] };
  return {
    status: issues.length ? "PENDIENTE_DATOS" : "LISTO_PARA_GENERAR",
    issues,
    pendingFields,
  };
}
