import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';

// Әр сайттың (3–4 / 5–6) өз базасы бар: OLYMP_DATABASE_URL.
// DEMO_MODE=1 және база берілмесе — Postgres жадта (PGlite) іске қосылады және
// demo/demo-data.json-дағы кездейсоқ деректермен толтырылады. SQL сұраныстары өзгермейді.
let sqlFn = null;
let ready = null;

export const isDemo = () => process.env.DEMO_MODE === '1' && !process.env.OLYMP_DATABASE_URL;

// PGlite-ті neon() сияқты орау: q`...` → жолдар массиві
function pgliteSql() {
  const dbP = import('@electric-sql/pglite').then(({ PGlite }) => new PGlite());
  return async (strings, ...values) => (await (await dbP).sql(strings, ...values)).rows;
}

export function sql() {
  if (!sqlFn) {
    const url = process.env.OLYMP_DATABASE_URL;
    if (url) sqlFn = neon(url);
    else if (isDemo()) sqlFn = pgliteSql();
    else throw new Error('OLYMP_DATABASE_URL is not set (or run with DEMO_MODE=1)');
  }
  return sqlFn;
}

// Демо: demo/demo-data.json → students + answers (күндер бүгінге қатысты, болашақ уақыттағы жауаптар алынбайды).
async function seedDemo(q) {
  const { allProblems, siteGroup, isCorrect, TZ_OFFSET_HOURS } = await import('./problems.js');
  const [{ c }] = await q`SELECT count(*)::int c FROM students`;
  if (c > 0) return;
  const file = new URL('../../demo/demo-data.json', import.meta.url);
  if (!fs.existsSync(file)) return;
  const grp = siteGroup();
  const data = JSON.parse(fs.readFileSync(file, 'utf8')).groups[grp];
  const problems = allProblems(grp);
  const ids = [];
  for (const s of data.students) {
    const [r] = await q`INSERT INTO students (key, name, grade) VALUES (${nameKey(s.name)}, ${normName(s.name)}, ${s.grade})
      ON CONFLICT (key) DO NOTHING RETURNING id`;
    ids.push(r ? r.id : null);
  }
  const now = Date.now();
  for (const a of data.answers) {
    const p = problems[a.day - 1];
    const sid = ids[a.s];
    if (!p || sid == null) continue;
    const at = Date.parse(p.date + 'T00:00:00Z') - TZ_OFFSET_HOURS * 3600e3 + a.minute * 60e3;
    if (at > now) continue;
    await q`INSERT INTO answers (student_id, problem_id, answer, correct, created_at)
      VALUES (${sid}, ${p.id}, ${a.answer}, ${isCorrect(p, a.answer)}, ${new Date(at).toISOString()})
      ON CONFLICT (student_id, problem_id) DO NOTHING`;
  }
}

// Кестелер бір рет жасалады; әр «суық» іске қосылуда бір рет қана тексеріледі.
export async function ensureSchema() {
  if (!ready) {
    const q = sql();
    ready = (async () => {
      await q`CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        grade INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        problem_id TEXT NOT NULL,
        answer TEXT NOT NULL,
        correct BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (student_id, problem_id)
      )`;
      if (isDemo()) await seedDemo(q);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Көрсетуге арналған аты: артық бос орын тазаланады, әр сөз бас әріппен.
export function normName(name) {
  return String(name || '')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .trim().replace(/\s+/g, ' ').slice(0, 80)
    .split(' ').map((w) => w.charAt(0).toLocaleUpperCase('ru') + w.slice(1)).join(' ');
}

// Салыстыру кілті: «Әли Серік», «серик али», «Али  Серік» → бір бала.
const KZ = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и', 'ё': 'е', 'й': 'и' };
export function nameKey(name) {
  return String(name || '').toLocaleLowerCase('ru')
    .replace(/[әғқңөұүһіёй]/g, (c) => KZ[c])
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim().split(/\s+/).filter(Boolean).sort().join(' ');
}

// Аты-жөні: кемінде 2 сөз (аты + тегі), әрқайсысы кемінде 2 әріп — бірдей атты балалар шатаспауы үшін.
export function validName(name) {
  const words = nameKey(name).split(' ').filter((w) => w.length >= 2);
  return words.length >= 2;
}

/** Баланы аты бойынша табу/тіркеу. Сынып өзгерсе (3↔4) — жаңартылады. */
export async function resolveStudent({ name, grade }, { create = true } = {}) {
  await ensureSchema();
  const q = sql();
  const key = nameKey(name);
  const [found] = await q`SELECT id, name, grade FROM students WHERE key = ${key}`;
  if (found) {
    if (grade != null && found.grade !== grade) {
      await q`UPDATE students SET grade = ${grade} WHERE id = ${found.id}`;
      found.grade = grade;
    }
    return found;
  }
  if (!create) return null;
  const [st] = await q`INSERT INTO students (key, name, grade) VALUES (${key}, ${normName(name)}, ${grade})
    ON CONFLICT (key) DO NOTHING RETURNING id, name, grade`;
  return st || resolveStudent({ name, grade }, { create: false });
}

/**
 * Жауапты БІР сұраныспен сақтау (жүктеме көп болғанда маңызды):
 * бала жоқ болса — тіркейді, бар болса — сыныбын жаңартады, сосын жауапты қосады.
 * Қайтарады: { name, inserted } — inserted=false болса, бұл есепке бұрын жауап берілген.
 */
export async function saveAnswer({ name, grade, problemId, answer, correct }) {
  await ensureSchema();
  const [r] = await sql()`
    WITH s AS (
      INSERT INTO students (key, name, grade) VALUES (${nameKey(name)}, ${normName(name)}, ${grade})
      ON CONFLICT (key) DO UPDATE SET grade = EXCLUDED.grade
      RETURNING id, name
    ), a AS (
      INSERT INTO answers (student_id, problem_id, answer, correct)
      SELECT id, ${problemId}, ${answer}, ${correct} FROM s
      ON CONFLICT (student_id, problem_id) DO NOTHING
      RETURNING id
    )
    SELECT s.name, EXISTS (SELECT 1 FROM a) AS inserted FROM s`;
  return r;
}

export async function hasAnswered(name, problemId) {
  await ensureSchema();
  const r = await sql()`SELECT 1 FROM answers a JOIN students s ON s.id = a.student_id
    WHERE s.key = ${nameKey(name)} AND a.problem_id = ${problemId}`;
  return r.length > 0;
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
