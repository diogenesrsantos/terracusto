import { EntryTypeManager } from "@/components/entry-type-manager";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EntryTypesPage() {
  await requirePermission("accounting.manage");
  const [accounts, entryTypes] = await Promise.all([
    db.account.findMany({ where: { active: true, analytic: true }, orderBy: { code: "asc" } }),
    db.entryType.findMany({ include: { defaultDebitAccount: true, defaultCreditAccount: true }, orderBy: { name: "asc" } }),
  ]);
  const accountOptions = accounts.map((account) => ({ id: account.id, label: `${account.code} — ${account.name}` }));

  return <>
    <PageHead title="Tipos de lançamento" subtitle="Configuração das contas padrão utilizadas no Centro de custos." />
    <EntryTypeManager accounts={accountOptions} entryTypes={entryTypes.map((entryType) => ({
      id: entryType.id,
      name: entryType.name,
      active: entryType.active,
      requiresAsset: entryType.requiresAsset,
      requiresPerson: entryType.requiresPerson,
      defaultDebitAccountId: entryType.defaultDebitAccountId,
      defaultCreditAccountId: entryType.defaultCreditAccountId,
      defaultDebitAccountLabel: `${entryType.defaultDebitAccount.code} — ${entryType.defaultDebitAccount.name}`,
      defaultCreditAccountLabel: `${entryType.defaultCreditAccount.code} — ${entryType.defaultCreditAccount.name}`,
    }))} />
  </>;
}
