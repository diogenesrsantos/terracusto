import { saveSystemSettings } from "@/app/actions";
import { PageHead } from "@/components/page";
import { ReportHeader } from "@/components/report-header";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await db.systemSettings.findUnique({
    where: { id: "default" },
    select: {
      legalName: true, cnpj: true, address: true, phone: true,
      responsibleName: true, responsiblePhone: true,
      reportImageFileName: true, reportImageMimeType: true,
    },
  });

  return <>
    <PageHead title="Configurações da empresa" subtitle="Informações padrão e imagem utilizadas nos relatórios do sistema." />
    <section className="card">
      <h2>Dados da empresa usuária</h2>
      <form action={saveSystemSettings} className="form-grid" encType="multipart/form-data">
        <label className="field span-2">Razão social<input name="legalName" defaultValue={settings?.legalName || ""} required /></label>
        <label className="field">CNPJ<input name="cnpj" defaultValue={settings?.cnpj || ""} inputMode="numeric" placeholder="00.000.000/0000-00" required /></label>
        <label className="field">Telefone<input name="phone" defaultValue={settings?.phone || ""} type="tel" required /></label>
        <label className="field span-4">Endereço<textarea name="address" defaultValue={settings?.address || ""} required /></label>
        <label className="field span-2">Responsável<input name="responsibleName" defaultValue={settings?.responsibleName || ""} required /></label>
        <label className="field span-2">Telefone do responsável<input name="responsiblePhone" defaultValue={settings?.responsiblePhone || ""} type="tel" required /></label>
        <label className="field span-2">Imagem dos relatórios<input name="reportImage" type="file" accept="image/png,image/jpeg,image/webp" /><small className="muted">PNG, JPEG ou WebP, com até 2 MB.</small></label>
        <div className="field span-2">
          <span>Imagem armazenada</span>
          {settings?.reportImageMimeType ? <><span>{settings.reportImageFileName || "Imagem atual"}</span><label><input className="inline-checkbox" name="removeImage" type="checkbox" value="true" /> Remover imagem atual</label></> : <span className="muted">Nenhuma imagem enviada.</span>}
        </div>
        <div className="form-actions"><button className="btn" type="submit">Salvar configurações</button></div>
      </form>
    </section>
    {settings && <section className="card mt"><h2>Prévia do cabeçalho dos relatórios</h2><ReportHeader title="Título do relatório" /></section>}
  </>;
}
