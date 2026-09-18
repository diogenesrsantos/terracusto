import type { Prisma } from "@prisma/client";
import { deleteFuelDispense, updateFuelDispense } from "@/app/actions";
import { Empty } from "@/components/page";
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
      <td>{locked ? <small className="muted">Medição fechada</small> : <details><summary className="action-link">Alterar/excluir</summary>
        <form action={updateFuelDispense} className="compact-edit-form">
          <input type="hidden" name="id" value={row.id} />
          <label>Data<input type="date" name="date" defaultValue={row.date.toISOString().slice(0, 10)} required /></label>
          <label>Litros<input type="number" name="liters" min="0.001" step="0.001" defaultValue={row.liters.toString()} required /></label>
          <label>Hor/Km<input type="number" name="meter" min="0" step="0.01" defaultValue={row.meter?.toString() || ""} required /></label>
          {row.source === "DIRECT_SUPPLIER" && <><label>Documento<input name="document" defaultValue={row.document || ""} required /></label><label>Preço/L<input type="number" name="unitPrice" min="0.0001" step="0.0001" defaultValue={row.unitPrice?.toString() || ""} required /></label>{row.paymentTerm === "CREDIT" && <label>Vencimento<input type="date" name="dueDate" defaultValue={row.dueDate?.toISOString().slice(0, 10) || ""} required /></label>}</>}
          <label>Operador<select name="personId" defaultValue={row.personId || ""}><option value="">Sem operador</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label>Observação<input name="notes" defaultValue={row.notes || ""} /></label>
          <button className="btn">Salvar alterações vinculadas</button>
        </form>
        <form action={deleteFuelDispense} className="compact-delete-form"><input type="hidden" name="id" value={row.id} /><label><input type="checkbox" name="confirmDelete" value="true" required /> Confirmo a exclusão de toda a operação</label><button className="btn danger-btn">Excluir operação</button></form>
      </details>}</td>
    </tr>;
  })}</tbody></table></div>;
}
