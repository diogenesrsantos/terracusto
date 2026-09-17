import { Empty, PageHead } from "@/components/page";
import { PrintButton } from "@/components/print-button";
import { ReportHeader } from "@/components/report-header";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money, number } from "@/lib/format";

type SearchParams = { competence?: string; supplierId?: string };

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
  const suppliers = await db.company.findMany({ where: { active: true, isFuelSupplier: true }, orderBy: { name: "asc" } });
  const selectedSupplier = suppliers.find((supplier) => supplier.id === params.supplierId);
  const competenceWhere = { source: "DIRECT_SUPPLIER" as const, ...(selectedSupplier ? { supplierId: selectedSupplier.id } : {}) };
  const competences = await db.fuelDispense.findMany({
    where: competenceWhere, distinct: ["date"], select: { date: true }, orderBy: { date: "desc" },
  });
  const availableCompetences = Array.from(new Set(competences.map((entry) => entry.date.toISOString().slice(0, 7))));
  const competence = validCompetence(params.competence) && availableCompetences.includes(params.competence!) ? params.competence! : "";
  const dispenses = competence ? await db.fuelDispense.findMany({
    where: { ...competenceWhere, date: { gte: competenceDate(competence), lt: nextCompetenceDate(competence) } },
    include: { fuelType: true, asset: true, person: true, supplier: true },
    orderBy: [{ fuelType: { name: "asc" } }, { date: "asc" }, { createdAt: "asc" }],
  }) : [];
  const fuelGroups = new Map<string, { name: string; rows: typeof dispenses; liters: number; total: number }>();
  for (const dispense of dispenses) {
    const current = fuelGroups.get(dispense.fuelTypeId) || { name: dispense.fuelType.name, rows: [], liters: 0, total: 0 };
    current.rows.push(dispense);
    current.liters += Number(dispense.liters);
    current.total += Number(dispense.totalCost);
    fuelGroups.set(dispense.fuelTypeId, current);
  }
  const groups = Array.from(fuelGroups.values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const totals = groups.reduce((total, group) => ({ liters: total.liters + group.liters, value: total.value + group.total }), { liters: 0, value: 0 });

  return <>
    <div className="no-print"><PageHead title="Abastecimento de combustível" subtitle="Consulte abastecimentos diretos em posto, por competência e combustível." /></div>
    <section className="card no-print"><form method="get" className="form-grid">
      <label className="field span-2">Posto de combustível<select name="supplierId" defaultValue={selectedSupplier?.id || ""}><option value="">Todos os postos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <label className="field span-2">Competência<select name="competence" defaultValue={competence} required><option value="">Selecione</option>{availableCompetences.map((value) => <option key={value} value={value}>{competenceLabel(value)}</option>)}</select></label>
      <div className="form-actions"><button className="btn">Gerar relatório</button></div>
    </form></section>
    {competence && <section className="report-sheet"><div className="report-actions no-print"><PrintButton /></div><ReportHeader title="Abastecimento de combustível" />
      <div className="report-meta"><strong>Competência:</strong> {competenceLabel(competence)}<br /><strong>Posto de combustível:</strong> {selectedSupplier?.name || "Todos os postos"}<br /><strong>Tipo:</strong> Agrupado por combustível</div>
      {groups.length === 0 ? <Empty>Nenhum abastecimento direto em posto encontrado para os filtros selecionados.</Empty> : <>
        {groups.map((group) => <section className="fuel-report-group" key={group.name}><h3>Combustível: {group.name}</h3><div className="table-wrap"><table><colgroup><col className="fuel-col-date" /><col className="fuel-col-coupon" /><col className="fuel-col-liters" /><col className="fuel-col-plate" /><col className="fuel-col-asset" /><col className="fuel-col-meter" /><col className="fuel-col-value" /><col className="fuel-col-person" /></colgroup><thead><tr><th>Data</th><th>Cupom</th><th className="text-right">Litros</th><th>Placa</th><th>Equipamento</th><th className="text-right">Hor/Km</th><th className="text-right">Valor</th><th>Motorista/Operador</th></tr></thead><tbody>{group.rows.map((dispense) => <tr key={dispense.id}><td>{date(dispense.date)}</td><td>{dispense.document || "—"}</td><td className="text-right">{number(dispense.liters, 2)}</td><td>{dispense.asset.identifier}</td><td>{dispense.asset.description}</td><td className="text-right">{dispense.meter === null ? "—" : number(dispense.meter, 2)}</td><td className="text-right">{money(dispense.totalCost)}</td><td>{dispense.person?.name || "—"}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Totais</th><th className="text-right">{number(group.liters, 2)}</th><th colSpan={3}>—</th><th className="text-right">{money(group.total)}</th><th>—</th></tr></tfoot></table></div></section>)}
        <div className="fuel-report-total">Total geral: <strong>{number(totals.liters, 2)} L</strong><strong>{money(totals.value)}</strong></div>
      </>}
      <p className="report-footer">Emitido em {date(new Date())}</p>
    </section>}
  </>;
}
