"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type HelpGuideForPage = {
  pageKey: string;
  title: string;
  steps: { id: string; title: string; content: string; images: { id: string }[] }[];
};

export function ContextualHelp({ guides }: { guides: HelpGuideForPage[] }) {
  const pathname = usePathname();
  const guide = guides.find((item) => item.pageKey === pathname && item.steps.length > 0);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => { setOpen(false); setStepIndex(0); }, [pathname]);
  if (!guide) return null;
  const step = guide.steps[stepIndex];
  const last = stepIndex === guide.steps.length - 1;

  return <>
    <button className="help-button no-print" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">? Ajuda</button>
    {open && <div className="help-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="help-dialog-head"><div><span>Ajuda · Passo {stepIndex + 1} de {guide.steps.length}</span><h2 id="help-title">{guide.title}</h2></div><button className="help-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar ajuda">×</button></div>
        <article className="help-step"><h3>{step.title}</h3><p>{step.content}</p>{step.images.length > 0 && <div className="help-images">{step.images.map((image) => <img key={image.id} src={`/api/ajuda/imagem/${image.id}`} alt={`Imagem do passo: ${step.title}`} />)}</div>}</article>
        <footer className="help-dialog-actions"><button className="btn secondary" type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)}>Anterior</button>{last ? <button className="btn" type="button" onClick={() => setOpen(false)}>Concluir</button> : <button className="btn" type="button" onClick={() => setStepIndex((index) => index + 1)}>Próximo</button>}</footer>
      </section>
    </div>}
  </>;
}
