import { compactAlnum, normalizeText } from "@/lib/customs/normalize";
import type { Destination, OperationType, ProcedureDecision } from "@/lib/customs/types";

export interface DestinationInput {
  postCode?: string | null;
  province?: string | null;
  city?: string | null;
  countryRegionCode?: string | null;
  address?: string | null;
}

export function classifyDestination(input: DestinationInput): Destination {
  const postCode = String(input.postCode ?? "").trim();
  const country = compactAlnum(input.countryRegionCode);
  const combined = normalizeText([input.province, input.city, input.address].filter(Boolean).join(" "));
  if (country && country !== "ES") return "OTRO";
  if (/^(35|38)\d{3}$/.test(postCode) || /\b(LAS PALMAS|TENERIFE|CANARIAS|CANARIA)\b/.test(combined)) return "CANARIAS";
  if (/^51\d{3}$/.test(postCode) || /\bCEUTA\b/.test(combined)) return "CEUTA";
  if (/^52\d{3}$/.test(postCode) || /\bMELILLA\b/.test(combined)) return "MELILLA";
  if (postCode || country === "ES") return "PENINSULA";
  return "DESCONOCIDO";
}

export function classifyOperation(input: DestinationInput & { documentNo?: string | null; customerName?: string | null; invoiceAmount?: number | null }): OperationType {
  const text = normalizeText([input.documentNo, input.customerName].filter(Boolean).join(" "));
  if (/MUESTRA|PROFESOR|GRATUIT/.test(text) || Number(input.invoiceAmount ?? 0) === 0) return "MUESTRA_PROFESOR";
  const destination = classifyDestination(input);
  if (destination === "CANARIAS") return "VENTA_CANARIAS";
  if (destination === "CEUTA") return "VENTA_CEUTA";
  if (destination === "MELILLA") return "VENTA_MELILLA";
  return "NO_ADUANERO";
}

export function defaultProcedure(operationType: OperationType): ProcedureDecision {
  if (operationType === "VENTA_CANARIAS") {
    return {
      procedureCode: "CANARIAS_INTRODUCCION",
      declarationCode: null,
      destinationCode: "IC",
      customsRegime: null,
      requiresXml: true,
      requiresT2lf: true,
      requiresRecipientVat: true,
      requiresConsent: false,
    };
  }
  if (operationType === "VENTA_CEUTA") {
    return {
      procedureCode: "CEUTA_EXPORTACION_EX",
      declarationCode: "EX",
      destinationCode: "XC",
      customsRegime: null,
      requiresXml: true,
      requiresT2lf: false,
      requiresRecipientVat: true,
      requiresConsent: false,
    };
  }
  if (operationType === "VENTA_MELILLA") {
    return {
      procedureCode: "MELILLA_EXPORTACION_EX",
      declarationCode: "EX",
      destinationCode: "XL",
      customsRegime: null,
      requiresXml: true,
      requiresT2lf: false,
      requiresRecipientVat: true,
      requiresConsent: false,
    };
  }
  return {
    procedureCode: null,
    declarationCode: null,
    destinationCode: null,
    customsRegime: null,
    requiresXml: false,
    requiresT2lf: false,
    requiresRecipientVat: false,
    requiresConsent: false,
  };
}
