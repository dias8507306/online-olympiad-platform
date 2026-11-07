import { GROUPS, publicProblems, siteGroup, todayAlmaty } from './_lib/problems.js';
import { readJson, hasAnswered, validName } from './_lib/db.js';

// Бүгінгі есеп (жауапсыз). name берілсе — бұл бала бүгін жауап берді ме (бір сұраныс).
// name берілмесе, база мүлдем қолданылмайды — бет өте жылдам ашылады.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = await readJson(req);
  try {
    const grp = siteGroup();
    const today = todayAlmaty();
    const list = publicProblems(grp, today);
    const p = list.find((x) => x.status === 'open') || null;
    let answered = false;
    if (p && validName(body.name)) {
      try { answered = await hasAnswered(body.name, p.id); } catch (e) { console.error(e); }
    }
    return res.status(200).json({ grp, grades: GROUPS[grp].grades, today, total: list.length, first: list[0].date, problem: p, answered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
