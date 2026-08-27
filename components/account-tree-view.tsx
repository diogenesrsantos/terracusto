"use client";

import Link from "next/link";
import { useState } from "react";

export type AccountTreeItem = {
  id: string;
  code: string;
  name: string;
  nature: "DEBIT" | "CREDIT";
  analytic: boolean;
  active: boolean;
  parentId: string | null;
};

const codeOrder = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function SyntheticIcon() {
  return <svg className="account-type-icon synthetic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 6.75h5l1.5 2h10v9.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2V6.75Z" /><path d="M3.75 9h16.5" /></svg>;
}

function AnalyticIcon() {
  return <svg className="account-type-icon analytic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.25 3.75h8l3.5 3.5v13H6.25v-16.5Z" /><path d="M14.25 3.75v4h3.5M9 12h6M9 15.5h6" /></svg>;
}

function EditIcon() {
  return <svg className="account-edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16.5-.75 3.25L7.5 19 18.25 8.25l-2.5-2.5L5 16.5Z" /><path d="m14.75 6.75 2.5 2.5" /></svg>;
}

export function AccountTreeView({ accounts, editingId = "" }: { accounts: AccountTreeItem[]; editingId?: string }) {
  const syntheticIds = accounts.filter((account) => !account.analytic).map((account) => account.id);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const accountIds = new Set(accounts.map((account) => account.id));
  const children = new Map<string | null, AccountTreeItem[]>();

  for (const account of accounts) {
    const parentId = account.parentId && accountIds.has(account.parentId) ? account.parentId : null;
    const group = children.get(parentId) || [];
    group.push(account);
    children.set(parentId, group);
  }
  for (const group of children.values()) group.sort((a, b) => codeOrder.compare(a.code, b.code));

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function renderBranch(account: AccountTreeItem, level: number): React.ReactNode {
    const descendants = children.get(account.id) || [];
    const isExpanded = expanded.has(account.id);
    const canExpand = !account.analytic && descendants.length > 0;

    return <div key={account.id} role="treeitem" aria-level={level + 1} aria-expanded={canExpand ? isExpanded : undefined}>
      <div className={`account-tree-row ${account.analytic ? "analytic" : "synthetic"}${editingId === account.id ? " selected" : ""}`} style={{ "--tree-level": level } as React.CSSProperties}>
        {canExpand ? <button className="tree-chevron" type="button" onClick={() => toggle(account.id)} aria-label={`${isExpanded ? "Contrair" : "Expandir"} conta ${account.code}`}><span aria-hidden="true">{isExpanded ? "−" : "+"}</span></button> : <span className="tree-chevron empty" aria-hidden="true" />}
        {account.analytic ? <AnalyticIcon /> : <SyntheticIcon />}
        <span className="account-tree-code">{account.code}</span>
        <span className="account-tree-name">{account.name}</span>
        <span className="account-tree-nature">{account.nature === "DEBIT" ? "Devedora" : "Credora"}</span>
        <span className={`badge${account.active ? "" : " warn"}`}>{account.active ? "Ativa" : "Inativa"}</span>
        <Link className="account-tree-edit" href={`/plano-contas?edit=${encodeURIComponent(account.id)}`} aria-label={`Editar conta ${account.code} — ${account.name}`}><EditIcon /><span>Editar</span></Link>
      </div>
      {canExpand && isExpanded && <div role="group">{descendants.map((child) => renderBranch(child, level + 1))}</div>}
    </div>;
  }

  return <>
    <div className="account-tree-toolbar">
      <div className="account-tree-legend"><span><SyntheticIcon /> Sintética</span><span><AnalyticIcon /> Analítica</span></div>
      <div><button className="tree-text-button" type="button" onClick={() => setExpanded(new Set(syntheticIds))}>Expandir tudo</button><button className="tree-text-button" type="button" onClick={() => setExpanded(new Set())}>Contrair tudo</button></div>
    </div>
    <div className="account-tree-head" aria-hidden="true"><span>Conta</span><span>Natureza</span><span>Situação</span><span>Ação</span></div>
    <div className="account-tree" role="tree" aria-label="Hierarquia do plano de contas">{(children.get(null) || []).map((account) => renderBranch(account, 0))}</div>
  </>;
}
