// Жүктеме тесті: N ата-ана бір мезетте сайтты ашып, жауап жіберсе не болады.
// Іске қосу: node tests/load.mjs https://eduapp-olymp-3-4.example.com 1000 200
// Тест балалары «Тестов…» деп аталады — кейін scenarios/cleanup арқылы өшіріледі.
const BASE = process.argv[2];
const N = Number(process.argv[3] || 1000);
const CONC = Number(process.argv[4] || 200);
if (!BASE) { console.error('usage: node tests/load.mjs <url> [N] [concurrency]'); process.exit(1); }

const ABC = 'абвгдежзиклмнопрстуфхцчшэюя';
const letters = (i) => { let s = ''; do { s = ABC[i % ABC.length] + s; i = Math.floor(i / ABC.length); } while (i > 0); return s; };
const nameOf = (i) => `Жүктеме Тестов${letters(i)}`;

async function run(label, n, conc, fn) {
  const lat = [], codes = {};
  let next = 0;
  const t0 = performance.now();
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) return;
      const s = performance.now();
      let code;
      try { code = await fn(i); } catch (e) { code = 'ERR:' + (e.cause?.code || e.name); }
      lat.push(performance.now() - s);
      codes[code] = (codes[code] || 0) + 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, n) }, worker));
  const total = (performance.now() - t0) / 1000;
  lat.sort((a, b) => a - b);
  const p = (q) => Math.round(lat[Math.min(lat.length - 1, Math.floor(q * lat.length))]);
  console.log(`\n${label}: ${n} сұраныс, бір мезетте ${conc}`);
  console.log(`  жауап кодтары: ${JSON.stringify(codes)}`);
  console.log(`  уақыт: барлығы ${total.toFixed(1)} с · ${Math.round(n / total)} сұраныс/с`);
  console.log(`  кідіріс (мс): медиана ${p(0.5)} · 95% ${p(0.95)} · 99% ${p(0.99)} · ең ұзақ ${Math.round(lat[lat.length - 1])}`);
  return codes;
}

const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const today = await (await post('/api/today', {})).json();
const pid = today.problem?.id;
const grades = today.grades;
if (!pid) { console.error('бүгін ашық есеп жоқ'); process.exit(1); }
console.log(`Сайт: ${BASE} · бүгінгі есеп: ${pid}`);

await run('1) Бетті ашу (index.html)', N, CONC, async () => (await fetch(BASE + '/')).status);
await run('2) Бүгінгі есепті алу (/api/today, атымен)', N, CONC, async (i) => (await post('/api/today', { name: nameOf(i) })).status);
await run('3) Жауап жіберу (/api/submit) — бәрі бір мезетте', N, CONC, async (i) => {
  const r = await post('/api/submit', { name: nameOf(i), grade: grades[i % 2], answer: String(50 + (i % 10)), problemId: pid });
  return r.status;
});
await run('4) Сол балалар қайта жіберсе (409 күтіледі)', Math.min(N, 300), CONC, async (i) => (await post('/api/submit', { name: nameOf(i), grade: grades[i % 2], answer: '1', problemId: pid })).status);
