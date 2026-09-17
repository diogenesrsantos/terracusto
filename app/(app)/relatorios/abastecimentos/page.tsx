import { Empty, PageHead } from "@/components/page";
import { PrintButton } from "@/components/print-button";
import { ReportHeader } from "@/components/report-header";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money, number } from "@/lib/format";

type SearchParams = { competence?: string; workId?: string };

const validCompetence = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}$/.test(value));
const competenceDate = (value: string) => new Date(`${value}-01T00:00:00.000Z`);
const nextCompetenceDate = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1));
};
const competenceLabel = (value: string) => competenceDate(value).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function FuelDispenseReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("fuel.manage");
  const params = await searchParams;
  const works = await db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const selectedWork = works.find((work) => work.id === params.workId);
  const competenceRows = selectedWork ? await db.fuelDispense.findMany({
    where: { workId: selectedWork.id, source: "DIRECT_SUPPLIER" },
    distinct: ["date"], select: { date: true }, orderBy: { date: "desc" },
  }) : [];
  const availableCompetences = Array.from(new Set(competenceRows.map((entry) => entry.date.toISOString().slice(0, 7))));
  const competence = validCompetence(params.competence) && availableCompetences.includes(params.competence!) ? params.competence! : "";
  const dispenses = selectedWork && competence ? await db.fuelDispense.findMany({
    where: { workId: selectedWork.id, source: "DIRECT_SUPPLIER", date: { gte: competenceDate(competence), lt: nextCompetenceDate(competence) } },
    include: { asset: true, person: true, supplier: true },
    orderBy: [{ supplier: { name: "asc" } }, { asset: { identifier: "asc" } }, { date: "asc" }, { createdAt: "asc" }],
  }) : [];

  type Dispense = (typeof dispenses)[number];
  type AssetGroup = { id: string; identifier: string; description: string; rows: Dispense[]; liters: number; total: number };
  type SupplierGroup = { id: string; name: string; assets: Map<string, AssetGroup>; liters: number; total: number };
  const supplierMap = new Map<string, SupplierGroup>();
  for (const dispense of dispenses) {
    const supplierId = dispense.supplierId || "without-supplier";
    const supplier = supplierMap.get(supplierId) || { id: supplierId, name: dispense.supplier?.name || "Posto não informado", assets: new Map<string, AssetGroup>(), liters: 0, total: 0 };
    const asset = supplier.assets.get(dispense.assetId) || { id: dispense.assetId, identifier: dispense.asset.identifier, description: dispense.asset.description, rows: [], liters: 0, total: 0 };
    const liters = Number(dispense.liters);
    const total = Number(dispense.totalCost);
    asset.rows.push(dispense);
    asset.liters += liters;
    asset.total += total;
    supplier.assets.set(dispense.assetId, asset);
    supplier.liters += liters;
    supplier.total += total;
    supplierMap.set(supplierId, supplier);
  }
  const supplierGroups = Array.from(supplierMap.values()).map((supplier) => ({ ...supplier, assetGroups: Array.from(supplier.assets.values()).sort((left, right) => left.identifier.localeCompare(right.identifier, "pt-BR")) })).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const totals = supplierGroups.reduce((total, supplier) => ({ liters: total.liters + supplier.liters, value: total.value + supplier.total }), { liters: 0, value: 0 });

  return <>
    <div className="no-print"><PageHead title="Relatório de abastecimentos" subtitle="Analise os abastecimentos diretos por centro de custo, posto e equipamento." /></div>
    <section className="card no-print"><form method="get" className="form-grid">
      <label className="field span-2">Centro de custo<select name="workId" defaultValue={selectedWork?.id || ""} required><option value="">Selecione</option>{works.map((work) => <option key={work.id} value={work.id}>{work.code} — {work.name}</option>)}</select></label>
      <label className="field span-2">Competência<select name="competence" defaultValue={competence} disabled={!selectedWork} required><option value="">{selectedWork ? "Selecione" : "Selecione primeiro o centro de custo"}</option>{availableCompetences.map((value) => <option key={value} value={value}>{competenceLabel(value)}</option>)}</select></label>
      <div className="form-actions"><button className="btn">Gerar relatório</button></div>
    </form></section>
    {selectedWork && competence && <section className="report-sheet fuel-cost-report"><div className="report-actions no-print"><PrintButton /></div><ReportHeader title="Relatório de abastecimentos" />
      <div className="report-meta"><strong>Centro de custo:</strong> {selectedWork.code} — {selectedWork.name}<br /><strong>Competência:</strong> {competenceLabel(competence)}</div>
      {supplierGroups.length === 0 ? <Empty>Nenhum abastecimento direto em posto encontrado para o centro de custo e a competência selecionados.</Empty> : <>
        {supplierGroups.map((supplier) => <section className="fuel-supplier-group" key={supplier.id}>
          <h2>Posto de combustível: {supplier.name}</h2>
          {supplier.assetGroups.map((asset) => <section className="fuel-asset-group" key={asset.id}>
            <h3>Equipamento: {asset.identifier} <small>— {asset.description}</small></h3>
            <div className="table-wrap"><table><colgroup><col className="fuel-cost-date" /><col className="fuel-cost-coupon" /><col className="fuel-cost-liters" /><col className="fuel-cost-value" /><col className="fuel-cost-meter" /><col className="fuel-cost-person" /></colgroup><thead><tr><th>Data</th><th>Cupom</th><th className="text-right">Litros</th><th className="text-right">Valor</th><th className="text-right">Hor/Km</th><th>Motorista/Operador</th></tr></thead><tbody>{asset.rows.map((dispense) => <tr key={dispense.id}><td>{date(dispense.date)}</td><td>{dispense.document || "—"}</td><td className="text-right">{number(dispense.liters, 2)}</td><td className="text-right">{money(dispense.totalCost)}</td><td className="text-right">{dispense.meter === null ? "—" : number(dispense.meter, 2)}</td><td>{dispense.person?.name || "—"}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total — {asset.identifier}</th><th className="text-right">{number(asset.liters, 2)} L</th><th className="text-right">{money(asset.total)}</th><th colSpan={2}></th></tr></tfoot></table></div>
          </section>)}
          <div className="fuel-supplier-total"><span>Total do posto: {supplier.name}</span><strong>{number(supplier.liters, 2)} L</strong><strong>{money(supplier.total)}</strong></div>
        </section>)}
        <div className="fuel-grand-total"><span>Total de todos os postos</span><strong>{number(totals.liters, 2)} L</strong><strong>{money(totals.value)}</strong></div>
      </>}
      <p className="report-footer">Emitido em {date(new Date())}</p>
    </section>}
  </>;
}
