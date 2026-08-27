import { assignActivity, createActivity, createJobFunction } from "@/app/actions";
import { PageHead } from "@/components/page";
import { PeopleManager } from "@/components/people-manager";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const PAGE_SIZE = 20;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("people.manage");
  const requestedPage = Number.parseInt((await searchParams).page || "1", 10);
  const totalPeople = await db.person.count();
  const totalPages = Math.max(1, Math.ceil(totalPeople / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const [people, personOptions, activities, jobFunctions] = await Promise.all([
    db.person.findMany({ include: { jobFunction: true, activities: { include: { activity: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.person.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.activity.findMany({ orderBy: { name: "asc" } }),
    db.jobFunction.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Pessoas" subtitle="Funcionários, operadores, motoristas, mecânicos e terceiros." />
    <PeopleManager key={page} people={people.map((person) => ({
      id: person.id, name: person.name, cpf: person.cpf, phone: person.phone, email: person.email,
      type: person.type, notes: person.notes, active: person.active, jobFunctionId: person.jobFunctionId,
      jobFunctionName: person.jobFunction?.name || null, activities: person.activities.map(({ activity }) => activity.name),
    }))} jobFunctions={jobFunctions.map(({ id, name }) => ({ id, name }))} page={page} totalPages={totalPages} totalPeople={totalPeople} />
    <section className="grid grid-3 mt"><div className="card"><h2>Nova função</h2><form action={createJobFunction} className="grid"><label className="field">Nome da função<input name="name" placeholder="Ex.: Motorista" required /></label><button className="btn">Cadastrar função</button></form></div>
      <div className="card"><h2>Nova atividade</h2><form action={createActivity} className="grid"><label className="field">Atividade<input name="name" placeholder="Ex.: Operar motoniveladora" required /></label><button className="btn">Cadastrar atividade</button></form></div>
      <div className="card"><h2>Vincular atividade</h2><form action={assignActivity} className="grid"><label className="field">Pessoa<select name="personId" required>{personOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="field">Atividade<select name="activityId" required>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label><button className="btn">Vincular</button></form></div></section>
  </>;
}
