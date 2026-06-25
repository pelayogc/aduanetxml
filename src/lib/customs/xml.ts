import type { CustomsFile, CustomsFileLine } from "@prisma/client";

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildCustomsXml(file: CustomsFile & { lines: CustomsFileLine[] }, version: number) {
  const lineXml = file.lines.map((line) => `
    <Linea>
      <Numero>${line.lineNo}</Numero>
      <Articulo>${escapeXml(line.itemNo)}</Articulo>
      <ISBN>${escapeXml(line.isbn)}</ISBN>
      <Descripcion>${escapeXml(line.description)}</Descripcion>
      <Cantidad>${line.quantity.toString()}</Cantidad>
      <PrecioUnitario>${line.unitPrice.toString()}</PrecioUnitario>
      <Importe>${line.lineAmount.toString()}</Importe>
      <CodigoMercancia>${escapeXml(line.taricCode || file.codigoMercancia)}</CodigoMercancia>
      <PaisOrigen>${escapeXml(line.countryOrigin || file.paisOrigen || "ES")}</PaisOrigen>
    </Linea>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ExpedienteAduanetXML version="${version}" procedimiento="${escapeXml(file.procedureCode)}">
  <ReferenciaInterna>${escapeXml(file.expedienteCode)}</ReferenciaInterna>
  <Expedidor>
    <RazonSocial>EDICIONES PARANINFO S.A.</RazonSocial>
    <NIF>ESA81461477</NIF>
    <Pais>ES</Pais>
  </Expedidor>
  <Destinatario>
    <Nombre>${escapeXml(file.customerName)}</Nombre>
    <NIF>${escapeXml(file.customerVatNo)}</NIF>
    <Direccion>${escapeXml(file.customerAddress)}</Direccion>
    <CodigoPostal>${escapeXml(file.customerPostCode)}</CodigoPostal>
    <Poblacion>${escapeXml(file.customerCity)}</Poblacion>
    <Provincia>${escapeXml(file.customerProvince)}</Provincia>
    <Pais>${escapeXml(file.customerCountryRegionCode || "ES")}</Pais>
  </Destinatario>
  <Factura>
    <Numero>${escapeXml(file.documentNo)}</Numero>
    <Fecha>${file.invoiceDate ? file.invoiceDate.toISOString().slice(0, 10) : ""}</Fecha>
    <Importe>${file.invoiceAmountIncludingVat.toString()}</Importe>
    <Moneda>${escapeXml(file.currencyCode || "EUR")}</Moneda>
  </Factura>
  <Mercancia>
    <Descripcion>${escapeXml(file.descripcionMercancia)}</Descripcion>
    <Codigo>${escapeXml(file.codigoMercancia)}</Codigo>
    <PartidaFactura>${escapeXml(file.partidaFacturaTexto)}</PartidaFactura>
    <PaisOrigen>${escapeXml(file.paisOrigen || "ES")}</PaisOrigen>
${lineXml}
  </Mercancia>
  <Logistica>
    <Bultos>${file.numBultos ?? ""}</Bultos>
    <PesoNetoKg>${file.pesoNetoKg?.toString() ?? ""}</PesoNetoKg>
    <PesoBrutoKg>${file.pesoBrutoKg?.toString() ?? ""}</PesoBrutoKg>
    <Transportista>${escapeXml(file.transportista)}</Transportista>
    <Tracking>${escapeXml(file.tracking)}</Tracking>
    <AduanaTexto>${escapeXml(file.aduanaTexto)}</AduanaTexto>
    <AduanaCodigoAEAT>${escapeXml(file.aduanaCodigoAeat)}</AduanaCodigoAEAT>
  </Logistica>
  <Aduana>
    <Declaracion>${escapeXml(file.declarationCode)}</Declaracion>
    <Destino>${escapeXml(file.destinationCode)}</Destino>
    <Regimen>${escapeXml(file.customsRegime)}</Regimen>
    <T2LF>${file.t2lf ? "true" : "false"}</T2LF>
  </Aduana>
</ExpedienteAduanetXML>
`;
}

export function extractResponseFields(xml: string) {
  const field = (names: string[]) => {
    for (const name of names) {
      const match = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "i"));
      if (match?.[1]?.trim()) return match[1].trim();
    }
    return null;
  };
  const errorCode = field(["CodigoError", "ErrorCode", "Code"]);
  const errorMessage = field(["DescripcionError", "ErrorMessage", "MensajeError", "Message"]);
  return {
    mrn: field(["MRN", "Mrn"]),
    csv: field(["CSV", "Csv"]),
    levante: field(["Levante", "NumeroLevante"]),
    circuito: field(["Circuito"]),
    errorCode,
    errorMessage,
    accepted: Boolean(field(["MRN", "CSV", "Levante"])) && !errorCode,
  };
}
