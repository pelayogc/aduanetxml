import { NextResponse } from "next/server";
import { syncAduanetXmlFolders } from "@/lib/customs/service";

function isAuthorized(request: Request) {
  const expected = process.env.INTERNAL_JOB_TOKEN;
  if (!expected) return true;
  const authorization = request.headers.get("authorization") || "";
  const token = request.headers.get("x-internal-job-token") || authorization.replace(/^Bearer\s+/i, "");
  return token === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({
      error: "No autorizado.",
      detail: "El endpoint de sincronizacion requiere INTERNAL_JOB_TOKEN.",
      source: "INTERNAL_JOB_TOKEN",
    }, { status: 401 });
  }
  try {
    const processed = await syncAduanetXmlFolders();
    return NextResponse.json({ processed });
  } catch (error) {
    return NextResponse.json({
      error: "No se pudo sincronizar AduanetXML.",
      detail: error instanceof Error ? error.message : "Error desconocido.",
      source: "ADUANETXML_SYNC",
    }, { status: 500 });
  }
}
