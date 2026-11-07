// Нақты базаға қарсы сценарийлер. «Тестов» тегімен жазылған тест балаларын соңында өшіреді.
// Іске қосу: node --env-file=.env.34 tests/scenarios.mjs   (және .env.56)
// Демо (базасыз, жадтағы PGlite): DEMO_MODE=1 GROUP=34 ADMIN_PASSWORD=local-test-123 node tests/scenarios.mjs
import assert from 'node:assert/strict';
import today from '../api/today.js';
import submit from '../api/submit.js';
import admin from '../api/admin.js';
import { sql, ensureSchema } from '../api/_lib/db.js';
import { siteGroup, GROUPS, allProblems, todayAlmaty } from '../api/_lib/problems.js';

const PW = process.env.ADMIN_PASSWORD;
const G = siteGroup();
const [g1, g2] = GROUPS[G].grades;
const open = allProblems(G).find((p) => p.date === todayAlmaty());
const other = G === '34' ? '56' : '34';

function call(handler, body) {
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { resolve({ status: this.statusCode, body: o }); } };
    Promise.resolve(handler({ method: 'POST', body }, res)).catch(reject);
  });
}
let n = 0;
async function step(t, fn) { await fn(); n++; console.log('✔', t); }

await ensureSchema();
const q = sql();
const clean = () => q`DELETE FROM students WHERE key LIKE '%тестов%' RETURNING id`;
await clean();

try {
  assert.ok(open, 'бүгін ашық есеп болуы керек');

  await step(`бүгінгі есеп бірден беріледі (${G} сайты, жауапсыз)`, async () => {
    const r = await call(today, {});
    assert.equal(r.status, 200);
    assert.equal(r.body.problem.id, open.id);
    assert.ok(!JSON.stringify(r.body).includes('"answer"'));
    assert.deepEqual(r.body.grades, [g1, g2]);
  });

  await step('аты + сынып + жауап → қабылданды', async () => {
    const r = await call(submit, { name: 'Әли Тестов', grade: g1, answer: '57', problemId: open.id });
    assert.equal(r.status, 200);
    assert.equal((await call(today, { name: 'әли тестов' })).body.answered, true);
  });

  await step('сол бала қайта жіберсе (аты басқаша жазылса да) — қабылданбайды', async () => {
    for (const nm of ['али тестов', 'ТЕСТОВ ӘЛИ']) {
      const r = await call(submit, { name: nm, grade: g1, answer: '1', problemId: open.id });
      assert.equal(r.body.error, 'already', nm);
    }
  });

  await step('сыныпты түзетуге болады (бір топ ішінде), бала екіге бөлінбейді', async () => {
    await call(submit, { name: 'Әли Тестов', grade: g2, answer: '1', problemId: open.id });
    const rows = await q`SELECT grade FROM students WHERE key LIKE '%тестов%'`;
    assert.equal(rows.length, 1); assert.equal(rows[0].grade, g2);
  });

  await step('бір отбасының екі баласы (әртүрлі аттар) — бөлек есептеледі', async () => {
    assert.equal((await call(submit, { name: 'Аружан Тестова', grade: g1, answer: '55', problemId: open.id })).status, 200);
  });

  await step('бұл сайтқа басқа топтың сыныбы / есебі өтпейді', async () => {
    const bad = GROUPS[other].grades[0];
    assert.equal((await call(submit, { name: 'Бекзат Тестов', grade: bad, answer: '5', problemId: open.id })).body.error, 'grade');
    assert.equal((await call(submit, { name: 'Бекзат Тестов', grade: g1, answer: '5', problemId: other + '-d1' })).body.error, 'problem');
  });

  await step('тек аты (тегісіз) / қате жауап / ашылмаған есеп — қабылданбайды', async () => {
    assert.equal((await call(submit, { name: 'Бекзат', grade: g1, answer: '5', problemId: open.id })).body.error, 'name');
    assert.equal((await call(submit, { name: 'Бекзат Тестов', grade: g1, answer: '5 не 6', problemId: open.id })).body.error, 'answer');
    assert.equal((await call(submit, { name: 'Бекзат Тестов', grade: g1, answer: '5', problemId: G + '-d2' })).body.error, 'closed');
  });

  await step('5 рет қатар басса да — бір ғана жауап', async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => call(submit, { name: 'Дана Тестова', grade: g2, answer: '57', problemId: open.id })));
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
  });

  await step('дашборд: құпиясөзсіз жабық; біріктіру мен түзету жұмыс істейді', async () => {
    assert.equal((await call(admin, { password: 'x' })).status, 401);
    await call(submit, { name: 'Дана Тестоваа', grade: g2, answer: '1', problemId: open.id }); // қате жазылған екінші жазба
    const d = (await call(admin, { password: PW })).body;
    const mine = d.students.filter((s) => s.key.includes('тестов'));
    const typo = mine.find((s) => s.name === 'Дана Тестоваа');
    const main = mine.find((s) => s.name === 'Дана Тестова');
    assert.equal((await call(admin, { password: PW, action: 'merge', fromId: typo.id, toId: main.id })).status, 200);
    const left = await q`SELECT count(*)::int c FROM students WHERE id = ${typo.id}`;
    assert.equal(left[0].c, 0);
    const a = mine.find((s) => s.name === 'Аружан Тестова');
    assert.equal((await call(admin, { password: PW, action: 'updateStudent', id: a.id, name: 'Дана Тестова', grade: g1 })).status, 409);
    assert.equal((await call(admin, { password: PW, action: 'updateStudent', id: a.id, name: 'Аружан Тестовна', grade: g2 })).status, 200);
  });

  console.log(`\n${G}: барлығы өтті — ${n} сценарий`);
} finally {
  console.log('Тест деректері өшірілді:', (await clean()).length);
}
