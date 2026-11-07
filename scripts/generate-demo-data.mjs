// Generates random demo participants and answers for local DEMO mode.
// Output: demo/demo-data.json (committed, so `node dev-server.mjs 34` works offline).
// Run:    node scripts/generate-demo-data.mjs [seed]
// Every name here is randomly composed from common Kazakh first names / surnames — no real people.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allProblems, GROUPS } from '../api/_lib/problems.js';
import { nameKey } from '../api/_lib/db.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = Number(process.argv[2] || 20261107);
const DAYS = 4; // 3 closed days + today (see DEMO_PAST_DAYS in problems.js)

// mulberry32 — small deterministic PRNG, so the same seed gives the same file
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(SEED);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const between = (a, b) => a + Math.floor(R() * (b - a + 1));

const BOYS = ['Ерлан', 'Әли', 'Нұрислам', 'Алихан', 'Арсен', 'Даниял', 'Ернар', 'Бекзат', 'Темірлан', 'Санжар', 'Ислам', 'Абылай', 'Нұрсұлтан', 'Мирас', 'Айбар', 'Ансар', 'Дастан', 'Елнұр', 'Рамазан', 'Тамерлан'];
const GIRLS = ['Айгерім', 'Аружан', 'Дана', 'Әйгерім', 'Жансая', 'Томирис', 'Амина', 'Інжу', 'Мадина', 'Аяулым', 'Сезім', 'Нұрай', 'Медина', 'Камила', 'Аиша', 'Еркежан', 'Айым', 'Ақбота', 'Балнұр', 'Дильназ'];
const ROOTS = ['Сапар', 'Нұрлан', 'Серік', 'Қайрат', 'Болат', 'Ержан', 'Асқар', 'Мұрат', 'Бауыржан', 'Жандос', 'Ғалым', 'Талғат', 'Дәулет', 'Арман', 'Еркін', 'Бекен', 'Сейіт', 'Тұрсын', 'Әділ', 'Марат'];
// surname in one of two common forms: «Сапаров/Сапарова» or «Нұрланұлы/Нұрланқызы»
function surname(boy) {
  const r = pick(ROOTS);
  if (R() < 0.6) return r + (boy ? 'ов' : 'ова');
  return r + (boy ? 'ұлы' : 'қызы');
}

// a wrong answer that looks like a typical mistake: off by a little, doubled/halved, or a random nearby number
function wrongAnswer(correct) {
  const c = Number(correct);
  const opts = [c + 1, c - 1, c + between(2, 9), Math.max(1, c - between(2, 9)), c * 2, Math.round(c / 2), Math.round(c * 1.1)];
  let v = pick(opts);
  if (v === c) v = c + 3;
  return String(v);
}
function fmtAnswer(v) {
  const n = Number(v);
  const r = R();
  if (n >= 1000 && r < 0.3) return String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1 '); // «1 275»
  if (r < 0.08) return v + ' ';
  return String(v);
}

function makeGroup(grp, count) {
  const grades = GROUPS[grp].grades;
  const problems = allProblems(grp).slice(0, DAYS);
  const used = new Set();
  const students = [];
  while (students.length < count) {
    const boy = R() < 0.5;
    const name = pick(boy ? BOYS : GIRLS) + ' ' + surname(boy);
    if (used.has(nameKey(name))) continue; // the app treats «Әли»/«Али» etc. as one child
    used.add(nameKey(name));
    students.push({ name, grade: pick(grades), skill: 0.25 + R() * 0.7, activity: 0.45 + R() * 0.55 });
  }
  // one realistic typo duplicate: the same child entered with a patronymic on another day → dashboard shows «⚠ ұқсас»
  const twin = students[between(0, students.length - 1)];
  students.push({ name: twin.name + ' ' + pick(ROOTS) + 'ұлы', grade: twin.grade, skill: twin.skill, activity: 0.2, typoOf: twin.name });

  const answers = [];
  problems.forEach((p, d) => {
    const difficulty = 0.15 + R() * 0.35; // share of children who get it wrong even when trying
    students.forEach((s, si) => {
      // fewer answers on later days (drop-off) and a weekday-like rhythm
      if (R() > s.activity * (1 - d * 0.07)) return;
      const correct = R() < s.skill * (1 - difficulty) + 0.15;
      const answer = correct ? fmtAnswer(p.answer) : wrongAnswer(p.answer);
      // minutes after 00:00 Almaty: most answers in the evening (18:00–22:00), some in the morning
      const minute = R() < 0.7 ? between(18 * 60, 22 * 60 + 30) : between(7 * 60, 17 * 60);
      answers.push({ s: si, day: d + 1, answer, minute });
    });
  });
  return { students: students.map(({ name, grade }) => ({ name, grade })), answers };
}

const out = {
  note: 'Randomly generated demo data (scripts/generate-demo-data.mjs). Names are random combinations, not real people.',
  seed: SEED,
  days: DAYS,
  groups: { '34': makeGroup('34', 46), '56': makeGroup('56', 58) },
};
const file = path.join(root, 'demo', 'demo-data.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
// one record per line: readable diffs, small file
const compact = JSON.stringify(out, null, 1).replace(/\{\n\s+("(?:name|s)":[^{}]*?)\n\s+\}/g, (m, body) => '{' + body.replace(/\n\s+/g, ' ') + '}');
fs.writeFileSync(file, compact + '\n');
for (const [g, v] of Object.entries(out.groups)) console.log(`group ${g}: ${v.students.length} students, ${v.answers.length} answers`);
console.log('→', path.relative(root, file));
