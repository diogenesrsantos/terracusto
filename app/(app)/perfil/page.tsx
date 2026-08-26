import { changePassword } from "@/app/actions";
import { PageHead } from "@/components/page";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requireUser(); const { ok } = await searchParams;
  return <><PageHead title="Minha conta" subtitle={`${user.name} · ${user.email}`} />
    <section className="card" style={{maxWidth: 620}}><h2>Alterar senha</h2>
      {ok && <p className="badge">Senha alterada com sucesso.</p>}
      <form action={changePassword} className="grid mt">
        <label className="field">Senha atual<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label className="field">Nova senha<input name="newPassword" type="password" minLength={10} autoComplete="new-password" required /></label>
        <label className="field">Confirme a nova senha<input name="confirmation" type="password" minLength={10} autoComplete="new-password" required /></label>
        <button className="btn">Salvar nova senha</button>
      </form>
    </section>
  </>;
}
