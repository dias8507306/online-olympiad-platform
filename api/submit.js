import { GROUPS, findProblem, isCorrect, parseAnswer, siteGroup, statusOf, todayAlmaty } from './_lib/problems.js';
import { readJson, saveAnswer, validName } from './_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = await readJson(req);
  try {
    const grp = siteGroup();
    const grade = Number(body.grade);
    const answer = String(body.answer ?? '').trim().slice(0, 40);
    if (!validName(body.name)) return res.status(400).json({ error: 'name' });
    if (!GROUPS[grp].grades.includes(grade)) return res.status(400).json({ error: 'grade' });
    if (parseAnswer(answer) === null) return res.status(400).json({ error: 'answer' });

    const p = findProblem(body.problemId);
    if (!p || p.grp !== grp) return res.status(400).json({ error: 'problem' });
    if (statusOf(p, todayAlmaty()) !== 'open') return res.status(409).json({ error: 'closed' });

    // Бір ғана сұраныс: тіркеу + жауап
    const r = await saveAnswer({ name: body.name, grade, problemId: p.id, answer, correct: isCorrect(p, answer) });
    if (!r.inserted) return res.status(409).json({ error: 'already', name: r.name });
    return res.status(200).json({ ok: true, name: r.name });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
