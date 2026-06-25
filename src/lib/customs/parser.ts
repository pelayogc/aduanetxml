import { isBooksTariff, normalizeTariff, normalizeText, parseDecimal, parsePositiveInteger } from "@/lib/customs/normalize";
import type { ParsedCustomsText } from "@/lib/customs/types";

function firstMatch(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function parseCustomsText(source: string): ParsedCustomsText {
  const raw = source.replace(/\r/g, "\n");
  const normalized = normalizeText(raw);
  const numBultos = parsePositiveInteger(firstMatch(normalized, [
    /(?:N[Oº°]?|NUM(?:ERO)?)\s*BULTOS?\s*[:.-]?\s*(\d+)/i,
    /BULTOS?\s*[:.-]?\s*(\d+)/i,
  ]));
  const pesoNetoKg = parseDecimal(firstMatch(normalized, [/PESO\s*NETO\s*[:.-]?\s*([\d.,]+\s*KG?)/i, /PESO\s*NETO\s*[:.-]?\s*([\d.,]+)/i]));
  const pesoBrutoKg = parseDecimal(firstMatch(normalized, [/PESO\s*BRUTO\s*[:.-]?\s*([\d.,]+\s*KG?)/i, /PESO\s*BRUTO\s*[:.-]?\s*([\d.,]+)/i]));
  const aduanaTexto = firstMatch(normalized, [
    /ADUANA\s*[:.-]?\s*([A-Z\s]+?)(?:\s+LIBROS|\s+PARTIDA|\s+T2LF|$)/i,
  ]);
  const partida = firstMatch(normalized, [
    /PARTIDA\s+ARANCELARIA\s*[:.-]?\s*([\d.,]+)/i,
    /PARTIDA\s*[:.-]?\s*([\d.,]+)/i,
  ]);
  const partidaFacturaTexto = normalizeTariff(partida);
  const t2lfIndicado = /T2LF/.test(normalized);
  const sinSoporteMagnetico = /SOPORTE\s+MAGNETICO|VIDEO\s+MAGNETICO/.test(normalized);
  const descripcionMercancia = /LIBROS\s+IMPRESOS/.test(normalized) || isBooksTariff(partidaFacturaTexto)
    ? "LIBROS IMPRESOS"
    : firstMatch(normalized, [/MERCANCIA\s*[:.-]?\s*([A-Z0-9\s]+)/i]);

  return {
    numBultos,
    pesoNetoKg,
    pesoBrutoKg,
    aduanaTexto,
    partidaFacturaTexto,
    t2lfIndicado,
    sinSoporteMagnetico,
    descripcionMercancia,
  };
}
