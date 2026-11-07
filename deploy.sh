#!/usr/bin/env bash
# Екі сайтты да (3–4 және 5–6) Vercel-ге жариялайды.
set -e
cd "$(dirname "$0")"
for p in eduapp-olymp-3-4 eduapp-olymp-5-6; do
  echo "== $p"
  rm -rf .vercel
  npx -y vercel@latest link --yes --project "$p" >/dev/null
  npx -y vercel@latest deploy --prod --yes 2>&1 | grep -E 'Aliased|Error' || true
done
