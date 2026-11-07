import { timingSafeEqual, createHash } from 'node:crypto';
import { GROUPS, allProblems, siteGroup, todayAlmaty } from './_lib/problems.js';
import { ensureSchema, sql, readJson, normName, nameKey, validName } from './_lib/db.js';

function passOk(given) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || !given) return false;
  const a = createHash('sha256').update(String(given)).digest();
  const b = createHash('sha256').update(real).digest();
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = await readJson(req);
  if (!passOk(body.password)) {
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'auth' });
  }

  try {
    const grp = siteGroup();
    await ensureSchema();
    const q = sql();

    if (body.action === 'deleteStudent') {
      await q`DELETE FROM students WHERE id = ${Number(body.id)}`;
      return res.status(200).json({ ok: true });
    }

    // Аты/сыныбын түзету (қате жазылған аттар үшін).
    if (body.action === 'updateStudent') {
      const id = Number(body.id);
      const grade = Number(body.grade);
      if (!validName(body.name) || !GROUPS[grp].grades.includes(grade)) return res.status(400).json({ error: 'invalid' });
      const key = nameKey(body.name);
      const [clash] = await q`SELECT id FROM students WHERE key = ${key} AND id <> ${id}`;
      if (clash) return res.status(409).json({ error: 'exists' });
      await q`UPDATE students SET name = ${normName(body.name)}, grade = ${grade}, key = ${key} WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    // Бір баланың екі жазбасын біріктіру (from → to). Екеуі бір есепке жауап берсе, to-ның жауабы қалады.
    if (body.action === 'merge') {
      const from = Number(body.fromId), to = Number(body.toId);
      const rows = await q`SELECT id FROM students WHERE id IN (${from}, ${to})`;
      if (from === to || rows.length !== 2) return res.status(400).json({ error: 'invalid' });
      await q`UPDATE answers SET student_id = ${to}
        WHERE student_id = ${from}
          AND problem_id NOT IN (SELECT problem_id FROM answers WHERE student_id = ${to})`;
      await q`DELETE FROM students WHERE id = ${from}`;
      return res.status(200).json({ ok: true });
    }

    const students = await q`SELECT id, key, name, grade, created_at FROM students ORDER BY id`;
    const answers = await q`SELECT id, student_id, problem_id, answer, correct, created_at FROM answers ORDER BY created_at`;
    return res.status(200).json({
      grp, today: todayAlmaty(), group: GROUPS[grp], problems: allProblems(grp), students, answers,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
