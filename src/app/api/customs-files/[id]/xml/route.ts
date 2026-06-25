import { NextResponse } from "next/server";
import { generateCustomsXml } from "@/lib/customs/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const submission = await generateCustomsXml(id);
    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo generar XML." }, { status: 500 });
  }
}
