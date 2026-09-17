"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { createFuelDispenseWithFeedback } from "@/app/actions";

type Option = { id: string; label: string };
type WorkOption = Option & { hasClient: boolean; blockedCompetence: string | null };
type AssetOption = Option & { enabled: boolean };
type TankOption = Option & { fuelTypeId: string };

export function FuelDispenseForm({
  tanks, fuelTypes, suppliers, works, assets, people, entryTypes,
}: {
  tanks: TankOption[];
  fuelTypes: Option[];
  suppliers: Option[];
  works: WorkOption[];
  assets: AssetOption[];
  people: Option[];
  entryTypes: Option[];
}) {
  const [source, setSource] = useState<"INTERNAL_TANK" | "DIRECT_SUPPLIER">("INTERNAL_TANK");
  const [fuelTypeId, setFuelTypeId] = useState("");
  const [tankId, setTankId] = useState("");
  const [workId, setWorkId] = useState("");
  const [paymentTerm, setPaymentTerm] = useState<"CASH" | "CREDIT">("CASH");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const selectedWork = useMemo(() => works.find((work) => work.id === workId), [workId, works]);
  const workHasClient = selectedWork?.hasClient || false;

  const clearError = (field: string) => setFieldErrors((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
  const error = (field: string) => fieldErrors[field];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    setSuccess("");
    try {
      const result = await createFuelDispenseWithFeedback(new FormData(event.currentTarget));
      if (!result.ok) {
        setFieldErrors({ [result.field]: result.error });
        return;
      }
      setSuccess("Abastecimento registrado. Os campos foram preservados para o próximo lançamento.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="form-grid">
    <label className="field">Data<input name="date" type="date" onChange={() => clearError("date")} aria-invalid={Boolean(error("date"))} required />{error("date") && <small className="field-error">{error("date")}</small>}</label>
    <label className="field">Origem<select name="source" value={source} onChange={(event) => { setSource(event.target.value as typeof source); setTankId(""); clearError("source"); }} aria-invalid={Boolean(error("source"))}><option value="INTERNAL_TANK">Tanque interno</option><option value="DIRECT_SUPPLIER">Fornecedor direto</option></select>{error("source") && <small className="field-error">{error("source")}</small>}</label>
    {source === "INTERNAL_TANK" ? <label className="field span-2">Tanque interno<select name="tankId" value={tankId} onChange={(event) => { const nextTankId = event.target.value; setTankId(nextTankId); const tank = tanks.find((item) => item.id === nextTankId); if (tank) setFuelTypeId(tank.fuelTypeId); clearError("tankId"); clearError("fuelTypeId"); }} aria-invalid={Boolean(error("tankId"))} required><option value="">Selecione</option>{tanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.label}</option>)}</select>{error("tankId") && <small className="field-error">{error("tankId")}</small>}</label> : <label className="field span-2">Fornecedor<select name="supplierId" onChange={() => clearError("supplierId")} aria-invalid={Boolean(error("supplierId"))} required><option value="">Selecione</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.label}</option>)}</select>{error("supplierId") && <small className="field-error">{error("supplierId")}</small>}</label>}
    <label className="field span-2">Equipamento/placa<select name="assetId" onChange={() => clearError("assetId")} aria-invalid={Boolean(error("assetId"))} required><option value="">Selecione</option>{assets.map((asset) => <option key={asset.id} value={asset.id} disabled={!asset.enabled}>{asset.label}{asset.enabled ? "" : " — configure tanque/consumo"}</option>)}</select>{error("assetId") && <small className="field-error">{error("assetId")}</small>}</label>
    <label className="field">Combustível<select name="fuelTypeId" value={fuelTypeId} onChange={(event) => { setFuelTypeId(event.target.value); clearError("fuelTypeId"); }} aria-invalid={Boolean(error("fuelTypeId"))} required><option value="">Selecione</option>{fuelTypes.map((fuelType) => <option key={fuelType.id} value={fuelType.id}>{fuelType.label}</option>)}</select>{error("fuelTypeId") && <small className="field-error">{error("fuelTypeId")}</small>}</label>
    {source === "DIRECT_SUPPLIER" && <><label className="field">Nota/cupom<input name="document" onChange={() => clearError("document")} aria-invalid={Boolean(error("document"))} required />{error("document") && <small className="field-error">{error("document")}</small>}</label><label className="field">Preço por litro<input name="unitPrice" type="number" min="0.0001" step="0.0001" onChange={() => clearError("unitPrice")} aria-invalid={Boolean(error("unitPrice"))} required />{error("unitPrice") && <small className="field-error">{error("unitPrice")}</small>}</label></>}
    <label className="field">Litros a completar<input name="liters" type="number" min="0.001" step="0.001" onChange={() => clearError("liters")} aria-invalid={Boolean(error("liters"))} required />{error("liters") && <small className="field-error">{error("liters")}</small>}</label>
    <label className="field">Horímetro/odômetro atual<input name="meter" type="number" min="0" step="0.01" onChange={() => clearError("meter")} aria-invalid={Boolean(error("meter"))} required />{error("meter") && <small className="field-error">{error("meter")}</small>}</label>
    {source === "DIRECT_SUPPLIER" && <><label className="field">Pagamento<select name="paymentTerm" value={paymentTerm} onChange={(event) => { setPaymentTerm(event.target.value as typeof paymentTerm); clearError("paymentTerm"); }} aria-invalid={Boolean(error("paymentTerm"))}><option value="CASH">À vista</option><option value="CREDIT">A prazo</option></select>{error("paymentTerm") && <small className="field-error">{error("paymentTerm")}</small>}</label>{paymentTerm === "CREDIT" && <label className="field">Vencimento<input name="dueDate" type="date" onChange={() => clearError("dueDate")} aria-invalid={Boolean(error("dueDate"))} required />{error("dueDate") && <small className="field-error">{error("dueDate")}</small>}</label>}</>}
    <label className="field span-2">Motorista/operador<select name="personId" onChange={() => clearError("personId")} aria-invalid={Boolean(error("personId"))}><option value="">Opcional</option>{people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select>{error("personId") && <small className="field-error">{error("personId")}</small>}</label>
    <label className="field span-2">Observação<input name="notes" /></label>
    <label className="field span-2">Obra<select name="workId" value={workId} onChange={(event) => { setWorkId(event.target.value); clearError("workId"); }} aria-invalid={Boolean(error("workId"))} required><option value="">Selecione</option>{works.map((work) => <option key={work.id} value={work.id}>{work.label}{work.hasClient ? "" : " — obra própria"}{work.blockedCompetence ? ` — fechar ${work.blockedCompetence}` : ""}</option>)}</select>{error("workId") && <small className="field-error">{error("workId")}</small>}</label>
    <label className="field span-2">Tipo de lançamento<select name="entryTypeId" onChange={() => clearError("entryTypeId")} aria-invalid={Boolean(error("entryTypeId"))} required><option value="">Selecione</option>{entryTypes.map((entryType) => <option key={entryType.id} value={entryType.id}>{entryType.label}</option>)}</select>{error("entryTypeId") && <small className="field-error">{error("entryTypeId")}</small>}</label>
    <label className="field span-4"><span><input className="inline-checkbox" name="reimbursable" type="checkbox" value="true" defaultChecked disabled={!workHasClient} />Incluir na medição mensal do cliente</span>{!workHasClient && workId && <small className="muted">Obras próprias não geram reembolso.</small>}</label>
    {selectedWork?.blockedCompetence && <p className="error span-4" role="alert">A competência {selectedWork.blockedCompetence} desta obra está pendente. <Link href="/fechamentos"><strong>Feche a competência anterior</strong></Link> para liberar novos lançamentos.</p>}
    {error("form") && <p className="error span-4" role="alert">{error("form")}</p>}
    {success && <p className="success span-4" role="status">{success}</p>}
    <button className="btn span-4" disabled={pending || Boolean(selectedWork?.blockedCompetence)}>{pending ? "Registrando..." : "Registrar tanque cheio e contabilizar"}</button>
  </form>;
}
