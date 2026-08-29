export function PageHead({ title, subtitle, aside }: { title: string; subtitle: string; aside?: React.ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div>{aside}</div>;
}
export function Empty({ children = "Nenhum registro encontrado." }: { children?: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
