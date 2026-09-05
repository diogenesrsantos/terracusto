import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { LoginPasswordField } from "@/components/login-password-field";

export const metadata: Metadata = { title: "Entrar" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSession()) redirect("/");
  const { erro } = await searchParams;
  return <main className="login-shell">
    <section className="login-brand"><h1>Terra<br />Custo</h1><p>Custos, máquinas e operações da sua empresa de terraplenagem em um só lugar.</p></section>
    <section className="login-panel"><div className="login-card">
      <h2>Acesse o sistema</h2><p className="muted">Informe suas credenciais para continuar.</p>
      {erro && <p className="error">{erro === "limite" ? "Muitas tentativas. Aguarde 15 minutos." : "E-mail ou senha inválidos."}</p>}
      <form action={login} className="grid">
        <label className="field">E-mail<input name="email" type="email" autoComplete="username" required autoFocus /></label>
        <LoginPasswordField />
        <button className="btn" type="submit">Entrar</button>
      </form>
    </div></section>
  </main>;
}
