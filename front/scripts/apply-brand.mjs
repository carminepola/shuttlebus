#!/usr/bin/env node
/**
 * Applica la brand identity al front prima di start/build.
 *
 * Brand scelto, in ordine: env BRAND -> ramo (env BRANCH, CI_COMMIT_REF_NAME,
 * GITHUB_REF_NAME, poi `git branch`) mappato in brands/branches.json -> default.
 *
 * Genera (file NON versionati, vedi .gitignore):
 *   src/brand/brand.ts            costante BRAND per il codice TypeScript
 *   src/brand/_brand.scss         palette e colori per SCSS
 *   src/index.html                da src/index.template.html
 *   src/assets/brand/             copia di brands/<brand>/assets + site.webmanifest
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS_DIR = path.join(ROOT, 'brands');
const SRC = path.join(ROOT, 'src');

export const REQUIRED_ASSETS = [
  'logo.png',
  'favicon.ico',
  'favicon.svg',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
  'hero.png',
  'about.png',
];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const HEX = /^#[0-9a-fA-F]{6}$/;

function fail(msg) {
  console.error(`\n[brand] ERRORE: ${msg}\n`);
  process.exit(1);
}

function currentBranch() {
  const fromEnv = process.env.BRANCH || process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF_NAME;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export function resolveBrandId() {
  const map = JSON.parse(fs.readFileSync(path.join(BRANDS_DIR, 'branches.json'), 'utf8'));
  if (process.env.BRAND) return { id: process.env.BRAND, reason: 'variabile BRAND' };
  const branch = currentBranch();
  if (branch && map.branches[branch]) return { id: map.branches[branch], reason: `ramo "${branch}"` };
  return { id: map.default, reason: `default (ramo "${branch || '?'}" non mappato)` };
}

export function loadBrand(id) {
  const dir = path.join(BRANDS_DIR, id);
  const file = path.join(dir, 'brand.json');
  if (!fs.existsSync(file)) fail(`brand "${id}" inesistente (manca ${path.relative(ROOT, file)})`);
  const brand = JSON.parse(fs.readFileSync(file, 'utf8'));
  validate(brand, dir);
  return brand;
}

function validate(b, dir) {
  const errors = [];
  for (const k of ['id', 'name', 'documentTitle', 'legalName', 'pdfTitle', 'siteUrl', 'manifestDescription']) {
    if (typeof b[k] !== 'string' || !b[k].trim()) errors.push(`campo "${k}" mancante`);
  }
  const c = b.colors || {};
  for (const k of ['theme', 'background']) if (!HEX.test(c[k] || '')) errors.push(`colors.${k} non e' un colore #rrggbb`);
  for (const p of ['primary', 'secondary']) {
    for (const s of SHADES) if (!HEX.test(c[p]?.[s] || '')) errors.push(`colors.${p}.${s} non e' un colore #rrggbb`);
    if (!SHADES.includes(String(c[`${p}Shade`]))) errors.push(`colors.${p}Shade deve essere una tonalita' (${SHADES.join(', ')})`);
  }
  if (!Array.isArray(b.companyInfo)) errors.push('companyInfo deve essere una lista di paragrafi');
  if (!b.images?.busStatus || !b.images?.aboutAlt) errors.push('images.busStatus / images.aboutAlt mancanti');
  for (const lng of ['it', 'en']) {
    for (const k of ['title', 'description', 'homeKeywords', 'pageKeywords']) {
      if (typeof b.seo?.[lng]?.[k] !== 'string') errors.push(`seo.${lng}.${k} mancante`);
    }
  }
  if (!b.seo?.homeTitle) errors.push('seo.homeTitle mancante');
  if (!Array.isArray(b.forbiddenTerms)) errors.push('forbiddenTerms deve essere una lista (anche vuota)');
  for (const a of REQUIRED_ASSETS) {
    if (!fs.existsSync(path.join(dir, 'assets', a))) errors.push(`asset mancante: assets/${a}`);
  }
  if (errors.length) fail(`brand "${b.id || path.basename(dir)}" non valido:\n  - ${errors.join('\n  - ')}`);
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in values)) fail(`segnaposto {{${k}}} senza valore`);
    return values[k];
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function writeIfChanged(file, content) {
  // non riscrive file identici: evita rebuild inutili di ng serve
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function scssMap(palette) {
  return '(\n' + SHADES.map((s) => `  ${s}: ${palette[s]},`).join('\n') + '\n)';
}

function apply() {
  const { id, reason } = resolveBrandId();
  const brand = loadBrand(id);
  const header = `GENERATO da scripts/apply-brand.mjs (brand "${id}") — non modificare: cambia brands/${id}/brand.json`;
  // forbiddenTerms serve solo a check-brand; le chiavi "$..." sono commenti nel JSON
  const { forbiddenTerms, ...rest } = brand;
  const publicBrand = Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('$')));

  writeIfChanged(
    path.join(SRC, 'brand', 'brand.ts'),
    `// ${header}\nimport { Brand } from './brand.model';\n\nexport const BRAND: Brand = ${JSON.stringify(publicBrand, null, 2)};\n`,
  );

  const c = brand.colors;
  writeIfChanged(
    path.join(SRC, 'brand', '_brand.scss'),
    `// ${header}\n` +
      `$brand-primary-palette: ${scssMap(c.primary)};\n` +
      `$brand-secondary-palette: ${scssMap(c.secondary)};\n` +
      `$brand-primary-shade: ${c.primaryShade};\n` +
      `$brand-secondary-shade: ${c.secondaryShade};\n` +
      `$brand-theme-color: ${c.theme};\n`,
  );

  const values = {
    name: escapeHtml(brand.name),
    documentTitle: escapeHtml(brand.documentTitle),
    themeColor: c.theme,
    backgroundColor: c.background,
    manifestDescription: brand.manifestDescription.replace(/"/g, '\\"'),
  };
  const index = fs.readFileSync(path.join(SRC, 'index.template.html'), 'utf8').replace(/^<!--.*?-->\s*/s, '');
  writeIfChanged(path.join(SRC, 'index.html'), fill(index, values));

  const assetsOut = path.join(SRC, 'assets', 'brand');
  fs.rmSync(assetsOut, { recursive: true, force: true });
  fs.cpSync(path.join(BRANDS_DIR, id, 'assets'), assetsOut, { recursive: true });
  const manifest = fill(fs.readFileSync(path.join(SRC, 'brand', 'site.webmanifest.template.json'), 'utf8'), values);
  JSON.parse(manifest); // manifest sempre JSON valido
  fs.writeFileSync(path.join(assetsOut, 'site.webmanifest'), manifest);

  console.log(`[brand] applicato "${id}" (${reason})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  apply();
}
