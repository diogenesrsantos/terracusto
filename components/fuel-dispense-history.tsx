import type { Prisma } from "@prisma/client";
import { Empty } from "@/components/page";
import { FuelDispenseEditor } from "@/components/fuel-dispense-editor";
import { money, number } from "@/lib/format";

type Dispense = Prisma.FuelDispenseGetPayload<{ include: {
  fuelType: true; tank: true; supplier: true; asset: true; work: true; person: true; measurement: true;
} }>;

export function FuelDispenseHistory({ dispenses, people }: { dispenses: Dispense[]; people: { id: string; name: string }[] }) {
  if (dispenses.length === 0) return <Empty />;
  return <div className="table-wrap"><table><thead><tr><th>Operação</th><th>Data</th><th>Origem</th><th>Equipamento</th><th>Obra</th><th>Litros</th><th>Medidor</th><th>Média</th><th>Custo</th><th>Medição</th><th>Ações</th></tr></thead><tbody>{dispenses.map((row) => {
    const locked = row.measurement?.status === "CLOSED";
    return <tr key={row.id}>
      <td><code title={row.operationId}>{row.operationId.slice(0, 8)}</code></td>
      <td>{row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
      <td>{row.source === "DIRECT_SUPPLIER" ? row.supplier?.name || "Fornecedor" : row.tank?.name || "Tanque"}<br /><small>{row.fuelType.name}{row.document ? ` · ${row.document}` : ""}</small></td>
      <td>{row.asset.identifier}<br /><small>{row.person?.name || "Sem operador"}</small></td>
      <td>{row.work.code}</td><td>{number(row.liters, 3)}</td><td>{row.meter ? number(row.meter, 2) : "—"}</td>
      <td>{row.consumptionRate ? `${number(row.consumptionRate, 3)} ${row.asset.consumptionMetric === "LITERS_PER_HOUR" ? "L/h" : "km/L"}` : "Primeira referência"}</td>
      <td>{money(row.totalCost)}</td><td>{!row.reimbursable ? "Não reembolsável" : row.measurement ? `Medição ${row.measurement.number}` : "Pendente"}</td>
      <td>{locked ? <small className="muted">Medição fechada</small> : <FuelDispenseEditor row={{ id: row.id, operationId: row.operationId, date: row.date.toISOString().slice(0, 10), liters: row.liters.toString(), meter: row.meter?.toString() || "", source: row.source, document: row.document || "", unitPrice: row.unitPrice?.toString() || "", paymentTerm: row.paymentTerm, dueDate: row.dueDate?.toISOString().slice(0, 10) || "", personId: row.personId || "", notes: row.notes || "" }} people={people} />}</td>
    </tr>;
  })}</tbody></table></div>;
}
