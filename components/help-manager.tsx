"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteHelpGuide, deleteHelpStep, deleteHelpStepImage, moveHelpStep, saveHelpGuide, saveHelpStep } from "@/app/actions";

export type HelpGuideManagerItem = {
  id: string; pageKey: string; title: string; active: boolean;
  steps: { id: string; position: number; title: string; content: string; images: { id: string; fileName: string }[] }[];
};
type PageOption = { key: string; label: string };

export function HelpManager({ guides, pages }: { guides: HelpGuideManagerItem[]; pages: PageOption[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(guides[0]?.id || "");
  const [error, setError] = useState("");
  const selected = guides.find((guide) => guide.id === selectedId) || null;

  async function safely(action: () => Promise<void>) {
    try { setError(""); await action(); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o manual."); }
  }
  async function submitGuide(form: FormData) {
    await safely(async () => { const id = await saveHelpGuide(form); setSelectedId(id); });
  }
  async function submitStep(form: FormData) { await safely(async () => { await saveHelpStep(form); }); }
  function run(action: (form: FormData) => Promise<unknown>, values: Record<string, string>) {
    const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, value));
    void safely(async () => { await action(form); });
  }

  return <div className="help-manager">
    {error && <p className="error" role="alert">{error}</p>}
    <section className="card"><h2>{selected ? "Editar manual" : "Novo manual"}</h2>
      <form key={selected?.id || "new"} action={submitGuide} className="form-grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field span-2">Página/módulo<select name="pageKey" defaultValue={selected?.pageKey || ""} required><option value="">Selecione</option>{pages.map((page) => <option key={page.key} value={page.key} disabled={guides.some((guide) => guide.pageKey === page.key && guide.id !== selected?.id)}>{page.label}</option>)}</select></label>
        <label className="field span-2">Título do manual<input name="title" defaultValue={selected?.title || ""} required /></label>
        {selected && <label className="field">Situação<select name="active" defaultValue={String(selected.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>}
        <div className="form-actions"><button className="btn secondary" type="button" onClick={() => setSelectedId("")}>Novo manual</button>{selected && <button className="btn danger" type="button" onClick={() => { if (window.confirm("Excluir este manual e todos os seus passos?")) { run(deleteHelpGuide, { id: selected.id }); setSelectedId(""); } }}>Excluir manual</button>}<button className="btn" type="submit">{selected ? "Salvar manual" : "Criar manual"}</button></div>
      </form>
    </section>

    <section className="card mt"><div className="list-head"><h2>Manuais cadastrados</h2><span className="muted">{guides.length}</span></div>
      {guides.length === 0 ? <p className="empty">Crie um manual e adicione seus passos.</p> : <div className="help-guide-list">{guides.map((guide) => <button className={`help-guide-item${guide.id === selected?.id ? " selected" : ""}`} type="button" key={guide.id} onClick={() => setSelectedId(guide.id)}><strong>{pages.find((page) => page.key === guide.pageKey)?.label || guide.pageKey}</strong><span>{guide.title} · {guide.steps.length} {guide.steps.length === 1 ? "passo" : "passos"} · {guide.active ? "Ativo" : "Inativo"}</span></button>)}</div>}
    </section>

    {selected && <section className="card mt"><h2>Passos de “{selected.title}”</h2>
      {selected.steps.map((step, index) => <article className="help-step-editor" key={step.id}><div className="help-step-editor-head"><strong>Passo {step.position}</strong><div><button className="tree-text-button" type="button" disabled={index === 0} onClick={() => run(moveHelpStep, { id: step.id, direction: "up" })}>Subir</button><button className="tree-text-button" type="button" disabled={index === selected.steps.length - 1} onClick={() => run(moveHelpStep, { id: step.id, direction: "down" })}>Descer</button><button className="tree-text-button danger-text" type="button" onClick={() => { if (window.confirm("Excluir este passo?")) run(deleteHelpStep, { id: step.id }); }}>Excluir</button></div></div>
        <form action={submitStep} className="form-grid" encType="multipart/form-data"><input type="hidden" name="id" value={step.id} /><input type="hidden" name="guideId" value={selected.id} /><label className="field span-2">Título do passo<input name="title" defaultValue={step.title} required /></label><label className="field span-2">Adicionar imagens<input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple /><small className="muted">PNG, JPEG ou WebP, até 3 MB por imagem; máximo de quatro.</small></label><label className="field span-4">Texto do passo<textarea name="content" defaultValue={step.content} required /></label><div className="help-step-image-list span-4">{step.images.map((image) => <figure key={image.id}><img src={`/api/ajuda/imagem/${image.id}`} alt={image.fileName} /><figcaption>{image.fileName}<button className="tree-text-button danger-text" type="button" onClick={() => run(deleteHelpStepImage, { id: image.id })}>Remover</button></figcaption></figure>)}</div><div className="form-actions"><button className="btn" type="submit">Salvar passo</button></div></form>
      </article>)}
      <article className="help-step-editor"><h3>Novo passo</h3><form action={submitStep} className="form-grid" encType="multipart/form-data"><input type="hidden" name="guideId" value={selected.id} /><label className="field span-2">Título do passo<input name="title" required /></label><label className="field span-2">Imagens<input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple /><small className="muted">PNG, JPEG ou WebP, até 3 MB por imagem; máximo de quatro.</small></label><label className="field span-4">Texto do passo<textarea name="content" required /></label><div className="form-actions"><button className="btn">Adicionar passo</button></div></form></article>
    </section>}
  </div>;
}
