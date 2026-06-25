import { NextResponse } from "next/server";
import { syncAduanetXmlFolders } from "@/lib/customs/service";

export async function POST() {
  try {
    const processed = await syncAduanetXmlFolders();
    return NextResponse.json({ processed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron procesar respuestas." }, { status: 500 });
  }
}
