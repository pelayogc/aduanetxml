"use client";

import { FileCheck, FileText, Save, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldLabel } from "@/app/field-label";

interface EditableFile {
  id: string;
  customerVatNo: string | null;
  customerAddress: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  numBultos: number | null;
  pesoNetoKg: string;
  pesoBrutoKg: string;
  aduanaTexto: string | null;
  aduanaCodigoAeat: string | null;
  codigoMercancia: string | null;
  descripcionMercancia: string | null;
  partidaFacturaTexto: string | null;
  consentimientoDestinatario: boolean;
  transportista: string | null;
  tracking: string | null;
  tipoBulto: string | null;
}

interface OfficeOption {
  normalizedText: string;
  aeatCode: string;
  officeType: string;
  notes: string;
}

interface GoodsOption {
  goodsCode: string;
  goodsDescription: string;
}

export function ExpedienteActions({ file, officeOptions, goodsOptions }: { file: EditableFile; officeOptions: OfficeOption[]; goodsOptions: GoodsOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [aduanaTexto, setAduanaTexto] = useState(file.aduanaTexto || "");
  const [aduanaCodigoAeat, setAduanaCodigoAeat] = useState(file.aduanaCodigoAeat || "");
  const [codigoMercancia, setCodigoMercancia] = useState(file.codigoMercancia || "");
  const [descripcionMercancia, setDescripcionMercancia] = useState(file.descripcionMercancia || "");

  function selectOffice(value: string) {
    const selected = officeOptions.find((office) => office.normalizedText === value);
    setAduanaTexto(value);
    setAduanaCodigoAeat(selected?.aeatCode || "");
  }

  function selectGoods(value: string) {
    const selected = goodsOptions.find((goods) => goods.goodsCode === value);
    setCodigoMercancia(value);
    setDescripcionMercancia(selected?.goodsDescription || "");
  }

  async function call(action: string, url: string, options?: RequestInit) {
    setLoading(action);
    setMessage(null);
    const response = await fetch(url, { method: "POST", ...options });
    const body = await response.json();
    setLoading(null);
    setMessage(response.ok ? "Operacion completada." : body.error || "Error en la operacion.");
    router.refresh();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("save");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.consentimientoDestinatario = form.get("consentimientoDestinatario") ? "true" : "false";
    const response = await fetch(`/api/customs-files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setLoading(null);
    setMessage(response.ok ? "Datos guardados." : data.error || "No se pudo guardar.");
    router.refresh();
  }

  return (
    <section className="panel">
      <h2>Completar datos</h2>
      <form className="form-grid" onSubmit={save}>
        <div className="field"><FieldLabel htmlFor="customerVatNo" help="NIF, CIF o VAT del destinatario de la factura. Se usa para identificar al receptor en la documentacion aduanera cuando el procedimiento lo exige.">NIF destinatario</FieldLabel><input id="customerVatNo" className="input" name="customerVatNo" defaultValue={file.customerVatNo || ""} /></div>
        <div className="field"><FieldLabel htmlFor="customerAddress" help="Direccion completa de entrega o facturacion del destinatario. Debe ser suficiente para identificar el destino real de la mercancia.">Direccion</FieldLabel><input id="customerAddress" className="input" name="customerAddress" defaultValue={file.customerAddress || ""} /></div>
        <div className="field"><FieldLabel htmlFor="customerPhone" help="Telefono de contacto del destinatario. Ayuda en incidencias de transporte o despacho.">Telefono</FieldLabel><input id="customerPhone" className="input" name="customerPhone" defaultValue={file.customerPhone || ""} /></div>
        <div className="field"><FieldLabel htmlFor="customerEmail" help="Correo del destinatario o contacto administrativo. Puede usarse para comunicaciones del expediente.">Email</FieldLabel><input id="customerEmail" className="input" name="customerEmail" defaultValue={file.customerEmail || ""} /></div>
        <div className="field"><FieldLabel htmlFor="numBultos" help="Numero total de paquetes fisicos que componen el envio. Debe coincidir con el packing list o el transporte.">Bultos</FieldLabel><input id="numBultos" className="input" name="numBultos" type="number" min="1" defaultValue={file.numBultos ?? ""} /></div>
        <div className="field"><FieldLabel htmlFor="pesoNetoKg" help="Peso de la mercancia sin embalajes exteriores, expresado en kilogramos.">Peso neto kg</FieldLabel><input id="pesoNetoKg" className="input" name="pesoNetoKg" inputMode="decimal" defaultValue={file.pesoNetoKg} /></div>
        <div className="field"><FieldLabel htmlFor="pesoBrutoKg" help="Peso total del envio incluyendo embalaje, expresado en kilogramos. No debe ser menor que el peso neto.">Peso bruto kg</FieldLabel><input id="pesoBrutoKg" className="input" name="pesoBrutoKg" inputMode="decimal" defaultValue={file.pesoBrutoKg} /></div>
        <div className="field">
          <FieldLabel htmlFor="aduanaTexto" help="Aduana de salida o expedicion. Al elegir una opcion se rellena automaticamente el codigo AEAT vinculado.">
            Aduana de salida/expedicion
          </FieldLabel>
          <select id="aduanaTexto" className="select" name="aduanaTexto" value={aduanaTexto} onChange={(event) => selectOffice(event.target.value)}>
            <option value="">Seleccionar aduana</option>
            {officeOptions.map((office) => (
              <option key={office.normalizedText} value={office.normalizedText}>{office.normalizedText} - {office.aeatCode}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <FieldLabel htmlFor="aduanaCodigoAeat" help="Codigo oficial AEAT de la aduana seleccionada. Es un campo reflejado y cambia al elegir la aduana.">
            Codigo AEAT aduana de salida
          </FieldLabel>
          <input id="aduanaCodigoAeat" className="input readonly" name="aduanaCodigoAeat" value={aduanaCodigoAeat} readOnly />
        </div>
        <div className="field">
          <FieldLabel htmlFor="codigoMercancia" help="Codigo TARIC o codigo de mercancia normalizado. Al elegirlo se rellena automaticamente la descripcion vinculada.">
            Codigo mercancia
          </FieldLabel>
          <select id="codigoMercancia" className="select" name="codigoMercancia" value={codigoMercancia} onChange={(event) => selectGoods(event.target.value)}>
            <option value="">Seleccionar mercancia</option>
            {goodsOptions.map((goods) => (
              <option key={goods.goodsCode} value={goods.goodsCode}>{goods.goodsCode} - {goods.goodsDescription}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <FieldLabel htmlFor="descripcionMercancia" help="Descripcion aduanera vinculada al codigo de mercancia seleccionado. Es un campo reflejado para mantener la relacion coherente.">
            Descripcion mercancia
          </FieldLabel>
          <input id="descripcionMercancia" className="input readonly" name="descripcionMercancia" value={descripcionMercancia} readOnly />
        </div>
        <div className="field"><FieldLabel htmlFor="partidaFacturaTexto" help="Partida arancelaria tal como aparece o se deduce de la factura/Navision. Sirve para validar y resolver el codigo de mercancia.">Partida factura</FieldLabel><input id="partidaFacturaTexto" className="input" name="partidaFacturaTexto" defaultValue={file.partidaFacturaTexto || ""} /></div>
        <div className="field"><FieldLabel htmlFor="transportista" help="Empresa o agente que transporta el envio. Completar cuando sea necesario para seguimiento o documentacion.">Transportista</FieldLabel><input id="transportista" className="input" name="transportista" defaultValue={file.transportista || ""} /></div>
        <div className="field"><FieldLabel htmlFor="tracking" help="Numero de seguimiento, albaran o referencia de transporte asociada al envio.">Tracking</FieldLabel><input id="tracking" className="input" name="tracking" defaultValue={file.tracking || ""} /></div>
        <div className="field"><FieldLabel htmlFor="tipoBulto" help="Tipo de embalaje usado en el envio, por ejemplo caja, paquete, palet o similar.">Tipo bulto</FieldLabel><input id="tipoBulto" className="input" name="tipoBulto" defaultValue={file.tipoBulto || ""} /></div>
        <div className="field"><FieldLabel htmlFor="consentimientoDestinatario" help="Indica si consta autorizacion o consentimiento del destinatario cuando el procedimiento lo requiera.">Consentimiento</FieldLabel><select id="consentimientoDestinatario" className="select" name="consentimientoDestinatario" defaultValue={file.consentimientoDestinatario ? "true" : ""}><option value="">No</option><option value="true">Si</option></select></div>
        <div className="actions">
          <button className="button" type="submit" disabled={loading === "save"}><Save size={16} />Guardar</button>
        </div>
      </form>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="button secondary" type="button" onClick={() => call("validate", `/api/customs-files/${file.id}/validate`)}><ShieldCheck size={16} />Validar</button>
        <button className="button secondary" type="button" onClick={() => call("documents", `/api/customs-files/${file.id}/documents`)}><FileText size={16} />Generar documentos</button>
        <button className="button secondary" type="button" onClick={() => call("xml", `/api/customs-files/${file.id}/xml`)}><FileCheck size={16} />Generar XML</button>
        <button className="button" type="button" onClick={() => call("send", `/api/customs-files/${file.id}/send-to-aduanetxml`)}><Send size={16} />Enviar a AduanetXML</button>
      </div>
      {loading && <p className="muted">Procesando {loading}...</p>}
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
