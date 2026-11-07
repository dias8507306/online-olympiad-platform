// Локалды тексеру сервері: public/ + api/ (Vercel-сіз).
// Іске қосу: node dev-server.mjs 34   (немесе 56) → .env.34 / .env.56 оқиды (бар болса).
// .env файлы / OLYMP_DATABASE_URL жоқ болса — DEMO режимі: жадтағы Postgres (PGlite) + кездейсоқ демо деректер.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const grpArg = process.argv[2] || '34';
const envFile = path.join(root, '.env.' + grpArg);
for (const line of (fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
process.env.GROUP ||= grpArg;
if (!process.env.OLYMP_DATABASE_URL) process.env.DEMO_MODE ||= '1';
process.env.ADMIN_PASSWORD ||= 'local-test-123';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORT = Number(process.env.PORT || (grpArg === '56' ? 4356 : 4334));

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/') && !url.pathname.includes('_')) {
    const file = path.join(root, 'api', url.pathname.slice(5) + '.js');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    let raw = '';
    for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    const mod = await import(pathToFileURL(file).href);
    return mod.default(req, res);
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.extname(p)) p += '.html';
  const file = path.join(root, 'public', p);
  if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('http://localhost:' + PORT + '  (admin: /admin)' + (process.env.DEMO_MODE === '1' ? '  · DEMO mode: in-memory DB with random data' : '')));
