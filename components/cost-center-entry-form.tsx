"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { saveEntry } from "@/app/actions";
import { Empty } from "@/components/page";

type Option = { id: string; label: string };
type WorkOption = Option & { competence: string; blocked: boolean };
type EntryTypeOption = Option & { defaultDebitAccountId: string; defaultCreditAccountId: string; requiresAsset: boolean; requiresPerson: boolean };
type EntryDraft = {
  entryTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
  date: string;
  history: string;
  document: string;
  assetId: string;
  personId: string;
};

const draftKey = (workId: string) => `terracusto.entryDraft.${workId}`;
export type CostCenterEntryItem = {
  id: string;
  date: string;
  history: string;
  document: string;
  amount: string;
  entryTypeId: string;
  entryTypeName: string;
  debitAccountId: string;
  creditAccountId: string;
  accountSummary: string[];
  assetId: string;
  assetLabel: string;
  personId: string;
  personName: string;
  startTime: string;
  endTime: string;
  secondStartTime: string;
  secondEndTime: string;
  hours: string;
};

export function CostCenterEntryForm({
  works,
  accounts,
  people,
  assets,
  entryTypes,
  entries,
  initialWorkId,
  page,
  totalPages,
  totalEntries,
  today,
}: {
  works: WorkOption[];
  accounts: Option[];
  people: Option[];
  assets: Option[];
  entryTypes: EntryTypeOption[];
  entries: CostCenterEntryItem[];
  initialWorkId: string;
  page: number;
  totalPages: number;
  totalEntries: number;
  today: string;
}) {
  const router = useRouter();
  const [workId, setWorkId] = useState(initialWorkId);
  const [entryTypeId, setEntryTypeId] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [date, setDate] = useState(today);
  const [history, setHistory] = useState("");
  const [document, setDocument] = useState("");
  const [amount, setAmount] = useState("");
  const [assetId, setAssetId] = useState("");
  const [personId, setPersonId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [secondStartTime, setSecondStartTime] = useState("");
  const [secondEndTime, setSecondEndTime] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [editing, setEditing] = useState<CostCenterEntryItem | null>(null);
  const selectedWork = useMemo(() => works.find((work) => work.id === workId), [workId, works]);
  const selectedEntryType = useMemo(() => entryTypes.find((entryType) => entryType.id === entryTypeId), [entryTypeId, entryTypes]);
  const showEquipmentJourney = Boolean(selectedEntryType?.requiresAsset || selectedEntryType?.requiresPerson);
  const elapsedMinutes = useMemo(() => {
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };
    if (!startTime || !endTime) return null;
    const firstElapsed = toMinutes(endTime) - toMinutes(startTime);
    if (firstElapsed <= 0) return null;
    if (!secondStartTime && !secondEndTime) return firstElapsed;
    if (!secondStartTime || !secondEndTime || toMinutes(secondStartTime) < toMinutes(endTime)) return null;
    const secondElapsed = toMinutes(secondEndTime) - toMinutes(secondStartTime);
    return secondElapsed > 0 ? firstElapsed + secondElapsed : null;
  }, [startTime, endTime, secondStartTime, secondEndTime]);

  function applyDraft(draft: EntryDraft | null) {
    setEntryTypeId(draft?.entryTypeId || "");
    setDebitAccountId(draft?.debitAccountId || "");
    setCreditAccountId(draft?.creditAccountId || "");
    setDate(draft?.date || today);
    setHistory(draft?.history || "");
    setDocument(draft?.document || "");
    setAssetId(draft?.assetId || "");
    setPersonId(draft?.personId || "");
  }

  function readDraft(value: string): EntryDraft | null {
    if (!value) return null;
    try {
      return JSON.parse(window.localStorage.getItem(draftKey(value)) || "null") as EntryDraft | null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (initialWorkId && works.some((work) => work.id === initialWorkId)) {
      setWorkId(initialWorkId);
      window.localStorage.setItem("terracusto.defaultWorkId", initialWorkId);
      applyDraft(readDraft(initialWorkId));
      setFormVersion((version) => version + 1);
      return;
    }
    const saved = window.localStorage.getItem("terracusto.defaultWorkId") || "";
    if (works.some((work) => work.id === saved)) router.replace(`/lancamentos?workId=${encodeURIComponent(saved)}&page=1`);
  }, [initialWorkId, router, works]);

  function selectWork(value: string) {
    setWorkId(value);
    setEditing(null);
    applyDraft(readDraft(value));
    setAmount("");
    setStartTime("");
    setEndTime("");
    setSecondStartTime("");
    setSecondEndTime("");
    if (value) {
      window.localStorage.setItem("terracusto.defaultWorkId", value);
      router.push(`/lancamentos?workId=${encodeURIComponent(value)}&page=1`);
    } else {
      window.localStorage.removeItem("terracusto.defaultWorkId");
      router.push("/lancamentos");
    }
  }

  function selectEntryType(value: string) {
    setEntryTypeId(value);
    const entryType = entryTypes.find((item) => item.id === value);
    setDebitAccountId(entryType?.defaultDebitAccountId || "");
    setCreditAccountId(entryType?.defaultCreditAccountId || "");
    if (!entryType?.requiresAsset && !entryType?.requiresPerson) {
      setAssetId("");
      setPersonId("");
      setStartTime("");
      setEndTime("");
      setSecondStartTime("");
      setSecondEndTime("");
    }
  }

  function editEntry(entry: CostCenterEntryItem) {
    setEditing(entry);
    setEntryTypeId(entry.entryTypeId);
    setDebitAccountId(entry.debitAccountId);
    setCreditAccountId(entry.creditAccountId);
    setDate(entry.date);
    setHistory(entry.history);
    setDocument(entry.document);
    setAmount(entry.amount);
    setAssetId(entry.assetId);
    setPersonId(entry.personId);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setSecondStartTime(entry.secondStartTime);
    setSecondEndTime(entry.secondEndTime);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitEntry(form: FormData) {
    const submittedWorkId = String(form.get("workId") || "");
    const draft: EntryDraft = {
      entryTypeId: String(form.get("entryTypeId") || ""),
      debitAccountId: String(form.get("debitAccountId") || ""),
      creditAccountId: String(form.get("creditAccountId") || ""),
      date: String(form.get("date") || today),
      history: String(form.get("history") || ""),
      document: String(form.get("document") || ""),
      assetId: String(form.get("assetId") || ""),
      personId: String(form.get("personId") || ""),
    };
    window.localStorage.setItem(draftKey(submittedWorkId), JSON.stringify(draft));
    await saveEntry(form);
    window.setTimeout(() => {
      applyDraft(draft);
      setEditing(null);
      setAmount("");
      setStartTime("");
      setEndTime("");
      setSecondStartTime("");
      setSecondEndTime("");
      setFormVersion((version) => version + 1);
    }, 0);
  }

  function cancelEditing() {
    setEditing(null);
    setAmount("");
    setStartTime("");
    setEndTime("");
    setSecondStartTime("");
    setSecondEndTime("");
  }

  return <><section className="card"><h2>{editing ? "Alteração de lançamento" : "Novo lançamento"}</h2><form key={formVersion} action={submitEntry} className="form-grid">
    <input type="hidden" name="id" value={editing?.id || ""} />
    <fieldset className="entry-group span-4"><legend>Obra e lançamento</legend>
      <div className="entry-row entry-row-work">
        <label className="field">Obra<select name="workId" required value={workId} onChange={(event) => selectWork(event.target.value)}><option value="">Selecione</option>{works.map((work) => <option key={work.id} value={work.id}>{work.label}</option>)}</select></label>
        <label className="field">Competência<input value={selectedWork?.competence.slice(0, 7) || ""} placeholder="Selecione a obra" readOnly /></label>
        <label className="field">Data<input name="date" type="date" min={selectedWork?.competence} max={today} value={date} onChange={(event) => setDate(event.target.value)} required disabled={!selectedWork || selectedWork.blocked} /></label>
      </div>
      <div className="entry-row entry-row-history">
        <label className="field"><span className="nowrap-label">Histórico - opc.</span><input name="history" value={history} onChange={(event) => setHistory(event.target.value)} disabled={!selectedWork || selectedWork.blocked} /></label>
        <label className="field">Documento<input name="document" value={document} onChange={(event) => setDocument(event.target.value)} disabled={!selectedWork || selectedWork.blocked} /></label>
        <label className="field">Valor cobrado (R$)<input name="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={!selectedWork || selectedWork.blocked} /></label>
      </div>
    </fieldset>
    {selectedWork?.blocked && <p className="error span-4">A competência desta obra venceu. <Link href="/fechamentos"><strong>Feche a competência pendente</strong></Link> para liberar o mês vigente.</p>}
    <fieldset className="entry-group span-4" disabled={!selectedWork || selectedWork.blocked}><legend>Classificação contábil</legend>
      <div className="entry-row entry-row-accounts">
        <label className="field">Tipo de lançamento<select name="entryTypeId" required value={entryTypeId} onChange={(event) => selectEntryType(event.target.value)}><option value="">Selecione</option>{entryTypes.map((entryType) => <option key={entryType.id} value={entryType.id}>{entryType.label}</option>)}</select></label>
        <label className="field">Conta devedora<select name="debitAccountId" required value={debitAccountId} onChange={(event) => setDebitAccountId(event.target.value)}><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
        <label className="field">Conta credora<select name="creditAccountId" required value={creditAccountId} onChange={(event) => setCreditAccountId(event.target.value)}><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
      </div>
    </fieldset>
    {showEquipmentJourney && <fieldset className="entry-group span-4" disabled={!selectedWork || selectedWork.blocked}><legend>Equipamento e jornada</legend>
      <div className="entry-row entry-row-2">
        <label className="field">Equipamento<select name="assetId" value={assetId} onChange={(event) => setAssetId(event.target.value)} required={selectedEntryType?.requiresAsset}><option value="">Não se aplica</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
        <label className="field">Operador/motorista<select name="personId" value={personId} onChange={(event) => setPersonId(event.target.value)} required={selectedEntryType?.requiresPerson}><option value="">Não se aplica</option>{people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label>
      </div>
      <div className="entry-row entry-row-hours">
        <label className="field">Hora de início<input name="startTime" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
        <label className="field">Hora final<input name="endTime" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        <label className="field"><span className="nowrap-label">Segundo início - opc.</span><input name="secondStartTime" type="time" value={secondStartTime} onChange={(event) => setSecondStartTime(event.target.value)} /></label>
        <label className="field"><span className="nowrap-label">Segundo final - opc.</span><input name="secondEndTime" type="time" value={secondEndTime} onChange={(event) => setSecondEndTime(event.target.value)} /></label>
        <label className="field">Total de horas<output className="elapsed-total" aria-live="polite">{elapsedMinutes !== null ? <>{Math.floor(elapsedMinutes / 60)}h{elapsedMinutes % 60 ? ` ${elapsedMinutes % 60}min` : ""}</> : "—"}</output></label>
      </div>
    </fieldset>}
    <div className="form-actions">{editing && <button className="btn secondary" type="button" onClick={cancelEditing}>Cancelar alteração</button>}<button className="btn" disabled={!selectedWork || selectedWork.blocked}>{editing ? "Salvar alteração" : "Contabilizar lançamento"}</button></div>
  </form></section>
  <section className="card mt"><div className="list-head"><h2>Lançamentos da obra</h2><span className="muted">{totalEntries} {totalEntries === 1 ? "lançamento" : "lançamentos"}</span></div>
    {!workId ? <Empty>Selecione uma obra para visualizar seus lançamentos.</Empty> : entries.length === 0 ? <Empty>Nenhum lançamento nesta obra.</Empty> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Tipo/histórico</th><th>Contas</th><th>Equipamento/pessoa</th><th>Hora de início</th><th>Hora final</th><th>Duração</th><th className="text-right">Valor</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className={`selectable-row${editing?.id === entry.id ? " selected" : ""}`} onClick={() => editEntry(entry)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); editEntry(entry); } }} role="button" tabIndex={0} aria-selected={editing?.id === entry.id}>
      <td>{new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td><span className="badge">{entry.entryTypeName}</span><br />{entry.history}<br /><small className="muted">{entry.document || "Sem documento"}</small></td><td>{entry.accountSummary.map((line) => <small key={line} style={{ display: "block" }}>{line}</small>)}</td><td>{entry.assetLabel || "—"}<br /><small>{entry.personName}</small></td><td>{entry.startTime ? <>1º: {entry.startTime}{entry.secondStartTime && <><br />2º: {entry.secondStartTime}</>}</> : "—"}</td><td>{entry.endTime ? <>1º: {entry.endTime}{entry.secondEndTime && <><br />2º: {entry.secondEndTime}</>}</> : "—"}</td><td>{entry.hours || "—"}</td><td className="text-right">{Number(entry.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
    </tr>)}</tbody></table></div>}
    {workId && <nav className="pagination" aria-label="Paginação de lançamentos">{page > 1 ? <Link className="btn secondary" href={`/lancamentos?workId=${encodeURIComponent(workId)}&page=${page - 1}`}>Anterior</Link> : <button className="btn secondary" type="button" disabled>Anterior</button>}<span>Página {page} de {totalPages}</span>{page < totalPages ? <Link className="btn secondary" href={`/lancamentos?workId=${encodeURIComponent(workId)}&page=${page + 1}`}>Próxima</Link> : <button className="btn secondary" type="button" disabled>Próxima</button>}</nav>}
  </section></>;
}
