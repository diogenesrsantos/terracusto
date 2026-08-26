const base = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3120";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Credenciais de smoke test ausentes.");

const loginPage = await fetch(`${base}/login`);
if (!loginPage.ok) throw new Error(`Login indisponível: ${loginPage.status}`);
const html = await loginPage.text();
const action = html.match(/name="(\$ACTION_ID_[^"]+)"/i)?.[1];
if (!action) throw new Error("Ação de login não encontrada.");

const form = new FormData();
form.set(action, ""); form.set("email", email); form.set("password", password);
const auth = await fetch(`${base}/login`, { method: "POST", body: form, redirect: "manual", headers: { origin: base } });
const cookie = auth.headers.getSetCookie().find((value) => value.startsWith("terracusto_session="));
if (![302, 303].includes(auth.status) || !cookie) throw new Error(`Login falhou: ${auth.status}`);

const dashboard = await fetch(`${base}/`, { headers: { cookie: cookie.split(";")[0] }, redirect: "manual" });
const dashboardHtml = await dashboard.text();
if (!dashboard.ok || !dashboardHtml.includes("Visão geral")) throw new Error(`Dashboard protegido falhou: ${dashboard.status}`);

const [health, manifest, worker] = await Promise.all([
  fetch(`${base}/api/health`), fetch(`${base}/manifest.webmanifest`), fetch(`${base}/sw.js`),
]);
if (!health.ok || !manifest.ok || !worker.ok) throw new Error("Health check ou recursos PWA indisponíveis.");
console.log("Smoke test concluído: login, dashboard, banco e PWA operacionais.");
