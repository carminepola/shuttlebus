#!/usr/bin/env node
/**
 * CI checker: nessun elemento di brand identity scritto nel codice del front.
 * Per OGNI brand in brands/ cerca in src/ (esclusi i file generati da apply-brand):
 *   - forbiddenTerms del brand.json (nomi, ragione sociale, P.IVA, telefoni, ...)
 *   - dominio del sito, mail e profili social
 *   - colori delle palette e theme color, in #esadecimale o rgb()/rgba()
 *   - riferimenti agli asset del brand fuori da /assets/brand/
 * Uso: npm run check:brand   (exit 1 se trova qualcosa)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS_DIR = path.join(ROOT, 'brands');
const SRC = path.join(ROOT, 'src');
const EXTS = new Set(['.ts', '.html', '.scss', '.css', '.json', '.webmanifest', '.svg']);
const GENERATED = new Set(['src/brand/brand.ts', 'src/brand/_brand.scss', 'src/index.html'].map((p) => path.join(ROOT, p)));
const GENERATED_DIRS = [path.join(SRC, 'assets', 'brand') + path.sep];
const ASSET_NAMES = ['logo', 'favicon', 'apple-touch-icon', 'web-app-manifest', 'site.webmanifest', 'hero', 'about'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1).slice(i, i + 2), 16));

function rulesFor(brand) {
  const rules = [];
  const add = (label, re) => rules.push({ label: `[${brand.id}] ${label}`, re });
  for (const t of brand.forbiddenTerms || []) add(`termine "${t}"`, new RegExp(escape(t), 'i'));
  try {
    add('dominio del sito', new RegExp(escape(new URL(brand.siteUrl).host), 'i'));
  } catch {}
  if (brand.contacts?.email) add('mail di contatto', new RegExp(escape(brand.contacts.email), 'i'));
  for (const url of Object.values(brand.social || {})) if (url) add('profilo social', new RegExp(escape(url.replace(/\/$/, '')), 'i'));
  const colors = new Set(
    [brand.colors.theme, ...Object.values(brand.colors.primary), ...Object.values(brand.colors.secondary), ...Object.values(brand.colors.extra || {})].map((c) => c.toLowerCase()),
  );
  for (const hex of colors) {
    add(`colore ${hex}`, new RegExp(`${escape(hex)}(?![0-9a-f])`, 'i'));
    const [r, g, b] = hexToRgb(hex);
    add(`colore rgb(${r}, ${g}, ${b}) = ${hex}`, new RegExp(`rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*[,)]`));
  }
  return rules;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const brands = fs
  .readdirSync(BRANDS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(BRANDS_DIR, d.name, 'brand.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(BRANDS_DIR, d.name, 'brand.json'), 'utf8')));

const rules = brands.flatMap(rulesFor);
rules.push({
  label: 'asset del brand fuori da /assets/brand/ (spostalo in brands/<brand>/assets)',
  re: new RegExp(`assets/(?!brand/)(${ASSET_NAMES.map(escape).join('|')})`, 'i'),
});

const problems = [];
for (const file of walk(SRC)) {
  if (GENERATED.has(file) || GENERATED_DIRS.some((d) => file.startsWith(d))) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const r of rules) if (r.re.test(line)) problems.push(`${path.relative(ROOT, file)}:${i + 1}  ${r.label}\n    ${line.trim().slice(0, 140)}`);
  });
}

if (problems.length) {
  console.error(`\n[check:brand] ${problems.length} riferimenti al brand scritti nel codice.`);
  console.error('Spostali in brands/<brand>/brand.json (BRAND nel codice, var(--brand-*) negli stili):\n');
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`[check:brand] OK: nessun riferimento ai brand (${brands.map((b) => b.id).join(', ')}) fuori da brands/.`);
