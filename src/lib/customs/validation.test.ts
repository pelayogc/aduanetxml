import { describe, expect, it } from "vitest";
import { defaultProcedure } from "@/lib/customs/classification";
import { validateCustomsFile } from "@/lib/customs/validation";

describe("validateCustomsFile", () => {
  it("blocks Canarias sales without required data", () => {
    const result = validateCustomsFile({
      documentNo: "NA-1",
      operationType: "VENTA_CANARIAS",
      destination: "CANARIAS",
      customerName: "Cliente",
      customerAddress: "Direccion",
      invoiceAmount: 100,
      currencyCode: "EUR",
      numBultos: 1,
      pesoNetoKg: 2,
      pesoBrutoKg: 1,
      productLineCount: 1,
      procedure: defaultProcedure("VENTA_CANARIAS"),
    });
    expect(result.status).toBe("PENDIENTE_DATOS");
    expect(result.pendingFields).toContain("pesoBrutoKg");
    expect(result.pendingFields).toContain("t2lf");
    expect(result.pendingFields).toContain("aduanaCodigoAeat");
  });

  it("accepts a complete Ceuta sale", () => {
    const result = validateCustomsFile({
      documentNo: "NA-2",
      operationType: "VENTA_CEUTA",
      destination: "CEUTA",
      customerName: "Cliente",
      customerVatNo: "B00000000",
      customerAddress: "Direccion",
      invoiceAmount: 100,
      currencyCode: "EUR",
      numBultos: 1,
      pesoNetoKg: 2,
      pesoBrutoKg: 3,
      aduanaCodigoAeat: "0801",
      codigoMercancia: "49019900",
      partidaFacturaTexto: "49,01",
      productLineCount: 1,
      procedure: defaultProcedure("VENTA_CEUTA"),
    });
    expect(result.status).toBe("LISTO_PARA_GENERAR");
    expect(result.issues).toHaveLength(0);
  });
});
