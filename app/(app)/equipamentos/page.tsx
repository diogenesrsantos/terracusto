import { createAsset } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const kind = { MACHINE: "Máquina", VEHICLE: "Veículo", TOOL: "Ferramenta", OTHER: "Outro" };
export default async function AssetsPage() {
  await requirePermission("assets.manage");
  const [assets, fuels] = await Promise.all([db.asset.findMany({ include: { fuelType: true }, orderBy: { identifier: "asc" } }), db.fuelType.findMany({ orderBy: { name: "asc" } })]);
  return <><PageHead title="Equipamentos" subtitle="Máquinas, veículos, ferramentas e outros ativos." />
    <section className="card"><h2>Novo equipamento</h2><form action={createAsset} className="form-grid">
      <label className="field">Tipo<select name="kind"><option value="MACHINE">Máquina</option><option value="VEHICLE">Veículo</option><option value="TOOL">Ferramenta</option><option value="OTHER">Outro</option></select></label>
      <label className="field">Identificador/placa<input name="identifier" required /></label><label className="field span-2">Descrição<input name="description" required /></label>
      <label className="field">Marca<input name="brand" /></label><label className="field">Modelo<input name="model" /></label>
      <label className="field">Combustível<select name="fuelTypeId"><option value="">Não se aplica</option>{fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="field">Consumo esperado<input name="expectedUsage" type="number" step="0.001" /></label><button className="btn span-4">Cadastrar equipamento</button>
    </form></section>
    <section className="card mt"><h2>Frota e ativos</h2>{assets.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Identificador</th><th>Tipo</th><th>Descrição</th><th>Marca/modelo</th><th>Combustível</th></tr></thead><tbody>
      {assets.map((a) => <tr key={a.id}><td><strong>{a.identifier}</strong></td><td>{kind[a.kind]}</td><td>{a.description}</td><td>{[a.brand, a.model].filter(Boolean).join(" ") || "—"}</td><td>{a.fuelType?.name || "—"}</td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
