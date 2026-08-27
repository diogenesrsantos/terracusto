import { db } from "@/lib/db";

export async function ReportHeader({ title }: { title: string }) {
  const settings = await db.systemSettings.findUnique({
    where: { id: "default" },
    select: {
      legalName: true, cnpj: true, address: true, phone: true,
      responsibleName: true, responsiblePhone: true, reportImageMimeType: true,
    },
  });

  return <header className="report-header">
    <div className="report-image-slot">
      {settings?.reportImageMimeType
        ? <img src="/api/configuracoes/imagem-relatorio" alt={`Identidade visual de ${settings.legalName}`} />
        : <span>Sem imagem</span>}
    </div>
    <div className="report-company">
      <strong>{settings?.legalName || "Empresa não configurada"}</strong>
      {settings && <>
        <span>CNPJ: {settings.cnpj} · Telefone: {settings.phone}</span>
        <span>{settings.address}</span>
        <span>Responsável: {settings.responsibleName} · {settings.responsiblePhone}</span>
      </>}
    </div>
    <h1>{title}</h1>
  </header>;
}
