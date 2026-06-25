import { NextResponse } from "next/server";
import { generateCustomsDocuments } from "@/lib/customs/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const documents = await generateCustomsDocuments(id);
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron generar documentos." }, { status: 500 });
  }
}
