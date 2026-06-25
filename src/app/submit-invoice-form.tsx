"use client";

import { useRouter } from "next/navigation";
import { FilePlus } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "@/app/field-label";

interface FormError {
  error: string;
  detail?: string;
  action?: string;
  source?: string;
}

export function SubmitInvoiceForm() {
  const router = useRouter();
  const [documentNo, setDocumentNo] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [loading, setLoading] = useState(false);

  async function createFile(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/customs-files/from-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentNo }),
    });
    const text = await response.text();
    let body: Partial<FormError> & { id?: string } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {
        error: "Respuesta no valida del servidor.",
        detail: text || `HTTP ${response.status}`,
        action: "Revisa los logs del servidor y vuelve a intentar.",
        source: "SERVER_RESPONSE",
      };
    }
    setLoading(false);
    if (!response.ok) {
      setError({
        error: body.error || "No se pudo crear el expediente.",
        detail: body.detail,
        action: body.action,
        source: body.source,
      });
      return;
    }
    if (!body.id) {
      setError({
        error: "Respuesta incompleta del servidor.",
        detail: "La creacion termino sin devolver el identificador del expediente.",
        action: "Revisa los logs del servidor y vuelve a intentar.",
        source: "SERVER_RESPONSE",
      });
      return;
    }
    router.push(`/expedientes/${body.id}`);
    router.refresh();
  }

  return (
    <form className="toolbar" onSubmit={createFile}>
      <div className="field">
        <FieldLabel htmlFor="create-document-no" help="Numero de factura que se consultara en Navision SQL Server para importar cabecera, lineas y texto aduanero, y crear o recuperar su expediente.">
          Crear expediente desde NAV
        </FieldLabel>
        <input id="create-document-no" className="input" value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} placeholder="NA-0718435" required />
      </div>
      <button className="button" type="submit" disabled={loading}><FilePlus size={16} />{loading ? "Consultando NAV" : "Consultar NAV y crear"}</button>
      {error && (
        <div className="error-box" role="alert">
          <strong>{error.error}</strong>
          {error.detail && <span>{error.detail}</span>}
          {error.action && <span>{error.action}</span>}
          {error.source && <small>Origen: {error.source}</small>}
        </div>
      )}
    </form>
  );
}
