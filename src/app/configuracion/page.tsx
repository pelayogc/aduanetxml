import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  let databaseError: string | null = null;
  const [offices, tariffs, rules, carriers] = await Promise.all([
      prisma.customsOffice.findMany({ orderBy: { normalizedText: "asc" }, take: 50 }),
      prisma.tariffMapping.findMany({ orderBy: { normalizedTariffText: "asc" }, take: 50 }),
      prisma.procedureRule.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
      prisma.carrier.findMany({ orderBy: { name: "asc" }, take: 50 }),
    ])
    .catch((error: unknown) => {
      databaseError = error instanceof Error ? error.message : "No se pudo consultar la base de datos.";
      return [[], [], [], []] as const;
    });

  return (
    <div className="grid">
      <section>
        <h1>Configuracion</h1>
        <p className="muted">Maestras iniciales. La edicion completa queda preparada para el siguiente hito.</p>
        {databaseError && <p className="badge warn">Base de datos no configurada: {databaseError}</p>}
      </section>
      <section className="grid two">
        <div className="panel">
          <h2>Aduanas</h2>
          {offices.map((item) => <p key={item.id}>{item.normalizedText} - {item.aeatCode}</p>)}
          {!offices.length && <p className="muted">Sin aduanas configuradas.</p>}
        </div>
        <div className="panel">
          <h2>Partidas</h2>
          {tariffs.map((item) => <p key={item.id}>{item.invoiceTariffText} - {item.goodsCode} - {item.goodsDescription}</p>)}
          {!tariffs.length && <p className="muted">Se usara la regla por defecto 49,01 a 49019900.</p>}
        </div>
        <div className="panel">
          <h2>Procedimientos</h2>
          {rules.map((item) => <p key={item.id}>{item.destination} - {item.operationType} - {item.procedureCode}</p>)}
          {!rules.length && <p className="muted">Se usaran procedimientos por defecto del MVP.</p>}
        </div>
        <div className="panel">
          <h2>Transportistas</h2>
          {carriers.map((item) => <p key={item.id}>{item.code} - {item.name}</p>)}
          {!carriers.length && <p className="muted">Sin transportistas configurados.</p>}
        </div>
      </section>
    </div>
  );
}
