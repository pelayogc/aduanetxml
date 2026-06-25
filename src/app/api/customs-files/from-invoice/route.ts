import { NextResponse } from "next/server";
import { z } from "zod";
import { createCustomsFileFromInvoice } from "@/lib/customs/service";

const schema = z.object({ documentNo: z.string().trim().min(1) });

function responseFromError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo crear el expediente.";
  if (message.includes("Navision SQL Server no esta configurado")) {
    return NextResponse.json({
      error: "No se puede consultar Navision porque falta configuracion.",
      detail: message,
      action: "Configura las variables NAV_SQLSERVER_* en .env.local y reinicia el servidor.",
      source: "NAV_SQLSERVER",
    }, { status: 500 });
  }
  if (message.includes("no encontrada en Navision")) {
    return NextResponse.json({
      error: "Factura no encontrada en Navision.",
      detail: message,
      action: "Comprueba el numero exacto de factura. Si es W41488, confirma si corresponde a otra serie/tabla distinta de Sales Invoice.",
      source: "NAVISION_INVOICE",
    }, { status: 404 });
  }
  return NextResponse.json({
    error: "No se pudo crear el expediente.",
    detail: message,
    action: "Revisa la configuracion NAV y los logs del servidor.",
    source: "APP",
  }, { status: 500 });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({
      error: "Peticion JSON no valida.",
      detail: "El cuerpo de la peticion debe ser JSON valido.",
      action: "Envia un objeto como {\"documentNo\":\"NA-0445802\"}.",
      source: "REQUEST_JSON",
    }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Numero de factura no valido.",
      detail: "El campo documentNo es obligatorio.",
      action: "Introduce un numero de factura, por ejemplo NA-0445802.",
      source: "VALIDATION",
    }, { status: 400 });
  }
  try {
    const file = await createCustomsFileFromInvoice(parsed.data.documentNo);
    return NextResponse.json({ id: file.id, expedienteCode: file.expedienteCode, status: file.status });
  } catch (error) {
    return responseFromError(error);
  }
}
