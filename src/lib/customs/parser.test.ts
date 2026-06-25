import { describe, expect, it } from "vitest";
import { parseCustomsText } from "@/lib/customs/parser";

describe("parseCustomsText", () => {
  it("extracts the customs legend from NAV invoice text", () => {
    const parsed = parseCustomsText(`NUESTRAS PUBLICACIONES NO LLEVAN
NINGUN SOPORTE MAGNETICO
NI VIDEO MAGNETICO
Nº BULTOS: 2
PESO NETO: 29,04
PESO BRUTO: 30,04
ADUANA: BARCELONA
LIBROS IMPRESOS POSTERIORIDAD
PARTIDA ARANCELARIA: 49,01
T2LF-Mercancia sin declaracion de expedicion`);

    expect(parsed).toMatchObject({
      numBultos: 2,
      pesoNetoKg: 29.04,
      pesoBrutoKg: 30.04,
      aduanaTexto: "BARCELONA",
      partidaFacturaTexto: "49,01",
      t2lfIndicado: true,
      sinSoporteMagnetico: true,
      descripcionMercancia: "LIBROS IMPRESOS",
    });
  });

  it("accepts dot decimals and T2LF with spaces", () => {
    const parsed = parseCustomsText("BULTOS: 1 PESO NETO: 1.50 KG PESO BRUTO: 2.00 KG ADUANA: MADRID PARTIDA: 4901 T2LF Mercancia");
    expect(parsed.numBultos).toBe(1);
    expect(parsed.pesoNetoKg).toBe(1.5);
    expect(parsed.pesoBrutoKg).toBe(2);
    expect(parsed.partidaFacturaTexto).toBe("49,01");
    expect(parsed.t2lfIndicado).toBe(true);
  });
});
