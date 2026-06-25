import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function contentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".xml") return "application/xml; charset=utf-8";
  if (ext === ".txt" || ext === ".log") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  const document = await prisma.customsDocument.findFirst({
    where: { id: documentId, customsFileId: id },
  });
  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  try {
    const content = await readFile(document.path);
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType(document.filename),
        "Content-Disposition": `attachment; filename="${document.filename.replaceAll('"', "")}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: "No se pudo leer el documento.",
      detail: error instanceof Error ? error.message : "Error desconocido.",
    }, { status: 500 });
  }
}
