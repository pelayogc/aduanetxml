export type Destination = "CANARIAS" | "CEUTA" | "MELILLA" | "PENINSULA" | "OTRO" | "DESCONOCIDO";

export type OperationType =
  | "VENTA_CANARIAS"
  | "VENTA_CEUTA"
  | "VENTA_MELILLA"
  | "MUESTRA_PROFESOR"
  | "NO_ADUANERO";

export type CustomsFileStatus =
  | "BORRADOR"
  | "PENDIENTE_DATOS"
  | "LISTO_PARA_GENERAR"
  | "XML_GENERADO"
  | "PENDIENTE_FIRMA_ENVIO"
  | "EN_PROCESO_ADUANETXML"
  | "FIRMADO_ENVIADO"
  | "ENVIADO_ADUANETXML"
  | "RECHAZADO_ADUANETXML"
  | "RESPUESTA_RECIBIDA"
  | "ADMITIDO"
  | "LEVANTE_OBTENIDO"
  | "ERROR_AEAT"
  | "ERROR_TECNICO"
  | "NO_REQUIERE_XML"
  | "ARCHIVADO"
  | "CANCELADO"
  | "PENDIENTE_REGENERAR_XML";

export interface ParsedCustomsText {
  numBultos: number | null;
  pesoNetoKg: number | null;
  pesoBrutoKg: number | null;
  aduanaTexto: string | null;
  partidaFacturaTexto: string | null;
  t2lfIndicado: boolean;
  sinSoporteMagnetico: boolean;
  descripcionMercancia: string | null;
}

export interface ProcedureDecision {
  procedureCode: string | null;
  declarationCode: string | null;
  destinationCode: string | null;
  customsRegime: string | null;
  requiresXml: boolean;
  requiresT2lf: boolean;
  requiresRecipientVat: boolean;
  requiresConsent: boolean;
}

export interface CustomsValidationInput {
  documentNo?: string | null;
  operationType: OperationType;
  destination: Destination;
  customerName?: string | null;
  customerVatNo?: string | null;
  customerAddress?: string | null;
  invoiceAmount?: number | null;
  currencyCode?: string | null;
  numBultos?: number | null;
  pesoNetoKg?: number | null;
  pesoBrutoKg?: number | null;
  aduanaCodigoAeat?: string | null;
  codigoMercancia?: string | null;
  partidaFacturaTexto?: string | null;
  t2lf?: boolean | null;
  transportista?: string | null;
  tracking?: string | null;
  consentimientoDestinatario?: boolean | null;
  productLineCount: number;
  procedure: ProcedureDecision;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  status: CustomsFileStatus;
  issues: ValidationIssue[];
  pendingFields: string[];
}
