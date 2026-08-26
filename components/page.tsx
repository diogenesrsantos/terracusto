export function PageHead({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}
export function Empty({ children = "Nenhum registro encontrado." }: { children?: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
