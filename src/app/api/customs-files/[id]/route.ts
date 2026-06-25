import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCustomsFile } from "@/lib/customs/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.customsFile.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineNo: "asc" } }, documents: true, xmlSubmissions: { orderBy: { version: "desc" } }, auditLogs: { orderBy: { eventDatetime: "desc" }, take: 50 } },
  });
  if (!file) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  return NextResponse.json(file);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const file = await updateCustomsFile(id, await request.json());
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar." }, { status: 500 });
  }
}
