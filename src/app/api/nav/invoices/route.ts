import { NextResponse } from "next/server";
import { getNavInvoiceByDocumentNo } from "@/lib/navision/invoices";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentNo = url.searchParams.get("documentNo")?.trim();
  if (!documentNo) return NextResponse.json({ error: "documentNo es obligatorio." }, { status: 400 });
  try {
    const invoice = await getNavInvoiceByDocumentNo(documentNo);
    if (!invoice) return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error leyendo Navision." }, { status: 500 });
  }
}
