import { cancelFuelMeasurement, closeFuelMeasurement, createFuelMeasurement, excludeFuelMeasurementItem, refreshFuelMeasurement } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money, number } from "@/lib/format";

const statusLabel = { DRAFT: "Rascunho", CLOSED: "Fechada", CANCELED: "Cancelada" } as const;

export default async function FuelMeasurementsPage() {
  await requirePermission("fuel.manage");
  const [works, measurements, pending] = await Promise.all([
    db.work.findMany({ where: { active: true, companyId: { not: null } }, include: { company: true }, orderBy: { code: "asc" } }),
    db.fuelMeasurement.findMany({ include: { work: true, company: true, dispenses: { include: { asset: true, tank: true, supplier: true }, orderBy: { date: "asc" } } }, orderBy: [{ competence: "desc" }, { number: "desc" }], take: 50 }),
    db.fuelDispense.count({ where: { reimbursable: true, measurementId: null } }),
  ]);
  return <><PageHead title="Medições de combustível" subtitle="Consolide mensalmente os custos reembolsáveis de cada obra." />
    <section className="card"><h2>Nova medição</h2><form action={createFuelMeasurement} className="form-grid">
      <label className="field span-2">Obra/cliente<select name="workId" required><option value="">Selecione</option>{works.map((work) => <option key={work.id} value={work.id}>{work.code} — {work.name} — {work.company?.name}</option>)}</select></label>
      <label className="field">Competência<input name="competence" type="month" required /></label>
      <label className="field">Observações<input name="notes" /></label>
      <p className="muted span-4">Há {pending} abastecimento(s) reembolsável(is) aguardando medição. A nova medição incorpora automaticamente os itens da obra e competência.</p>
      <button className="btn span-4">Criar medição em rascunho</button>
    </form></section>
    <section className="card mt"><h2>Medições recentes</h2>{measurements.length === 0 ? <Empty>Nenhuma medição cadastrada.</Empty> : <div className="measurement-list">{measurements.map((measurement) => <article className="measurement-card" key={measurement.id}>
      <div className="list-head"><div><strong>Medição nº {measurement.number}</strong><br /><small>{measurement.work.code} — {measurement.work.name} · {measurement.company.name} · {measurement.competence.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}</small></div><span className={`badge ${measurement.status === "DRAFT" ? "warn" : measurement.status === "CANCELED" ? "danger" : ""}`}>{statusLabel[measurement.status]}</span></div>
      {measurement.notes && <p>{measurement.notes}</p>}
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Equipamento</th><th>Origem</th><th>Litros</th><th className="text-right">Custo real</th>{measurement.status === "DRAFT" && <th>Ação</th>}</tr></thead><tbody>{measurement.dispenses.map((dispense) => <tr key={dispense.id}><td>{date(dispense.date)}</td><td>{dispense.asset.identifier}</td><td>{dispense.source === "DIRECT_SUPPLIER" ? dispense.supplier?.name : dispense.tank?.name}</td><td>{number(dispense.liters, 3)}</td><td className="text-right">{money(dispense.reimbursementAmount)}</td>{measurement.status === "DRAFT" && <td><form action={excludeFuelMeasurementItem}><input type="hidden" name="id" value={measurement.id} /><input type="hidden" name="dispenseId" value={dispense.id} /><button className="btn secondary">Não reembolsar</button></form></td>}</tr>)}</tbody><tfoot><tr><th colSpan={measurement.status === "DRAFT" ? 5 : 4}>{measurement.dispenses.length} abastecimento(s)</th><th className="text-right">{money(measurement.total)}</th></tr></tfoot></table></div>
      {measurement.status === "DRAFT" && <div className="form-actions measurement-actions"><form action={refreshFuelMeasurement}><input type="hidden" name="id" value={measurement.id} /><button className="btn secondary">Atualizar itens</button></form><form action={cancelFuelMeasurement}><input type="hidden" name="id" value={measurement.id} /><button className="btn danger">Cancelar rascunho</button></form><form action={closeFuelMeasurement}><input type="hidden" name="id" value={measurement.id} /><button className="btn" disabled={measurement.dispenses.length === 0}>Fechar e contabilizar</button></form></div>}
    </article>)}</div>}</section>
  </>;
}
