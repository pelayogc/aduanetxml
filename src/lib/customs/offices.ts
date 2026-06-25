import { normalizeText } from "@/lib/customs/normalize";

export interface CustomsOfficeMatch {
  normalizedText: string;
  aeatCode: string;
  officeType: string;
  notes: string;
}

export const defaultCustomsOffices: CustomsOfficeMatch[] = [
  {
    normalizedText: "BARCELONA",
    aeatCode: "ES000812",
    officeType: "SALIDA_EXPORTACION",
    notes: "Barcelona Maritima Exportacion. Usar para ventas/T2LF cuando NAV indica ADUANA: BARCELONA.",
  },
  {
    normalizedText: "BARCELONA MARITIMA EXPORTACION",
    aeatCode: "ES000812",
    officeType: "SALIDA_EXPORTACION",
    notes: "Barcelona Maritima Exportacion.",
  },
  {
    normalizedText: "BARCELONA MARITIMA EXP",
    aeatCode: "ES000812",
    officeType: "SALIDA_EXPORTACION",
    notes: "Barcelona Maritima Exportacion.",
  },
  {
    normalizedText: "BARCELONA MARITIMA",
    aeatCode: "ES000812",
    officeType: "SALIDA_EXPORTACION",
    notes: "Alias operativo: en expediciones se interpreta como Barcelona Maritima Exportacion.",
  },
];

export function findDefaultCustomsOffice(text: string | null): CustomsOfficeMatch | null {
  if (!text) return null;
  const normalized = normalizeText(text);
  return defaultCustomsOffices.find((office) => office.normalizedText === normalized) ?? null;
}
