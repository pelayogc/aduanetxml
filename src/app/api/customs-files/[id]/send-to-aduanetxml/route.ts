import { NextResponse } from "next/server";
import { sendLatestXmlToAduanetXml } from "@/lib/customs/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await sendLatestXmlToAduanetXml(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo enviar a AduanetXML." }, { status: 500 });
  }
}
