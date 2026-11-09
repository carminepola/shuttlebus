# Brand identity del front

Ogni cartella qui dentro è un brand: nome, testi, contatti, colori e immagini.
Il codice del front non contiene nessun dato di brand: li legge da qui al momento della build.

| Ramo   | Brand        |
|--------|--------------|
| `main` | `pintour`    |
| `dev`  | `test`       |
| `test` | `devmincorp` |

La mappa è in [`branches.json`](branches.json). I rami non elencati usano `default`.

## Come viene scelto il brand

`scripts/apply-brand.mjs` parte da solo prima di `npm start`, `npm run build`, `npm run build-prod`,
`npm test` e dopo `npm install`. Sceglie il brand in quest'ordine:

1. variabile `BRAND` (es. `BRAND=devmincorp npm start` per provarlo in locale);
2. il ramo: `BRANCH`, `CI_COMMIT_REF_NAME`, `GITHUB_REF_NAME`, altrimenti il ramo git corrente;
3. `default` di `branches.json`.

Genera questi file, che **non** sono versionati e non vanno modificati a mano:

- `src/brand/brand.ts`: la costante `BRAND`;
- `src/brand/_brand.scss`: le palette per SCSS;
- `src/index.html`: generato da `src/index.template.html`;
- `src/assets/brand/`: copia di `assets/` più `site.webmanifest`.

## Struttura di un brand

```
brands/<brand>/
  brand.json     nome, ragione sociale, contatti, social, SEO it/en, palette
  assets/        logo.png, favicon.ico, favicon.svg, favicon-96x96.png,
                 apple-touch-icon.png, web-app-manifest-192x192.png,
                 web-app-manifest-512x512.png, hero.png (sfondo homepage),
                 about.png (immagine homepage)
```

- **Palette:** `colors.primary` e `colors.secondary` hanno le tonalità 50…950. `primaryShade` e
  `secondaryShade` indicano quale tonalità è il colore principale (`$primary` e `$secondary` di Bootstrap).
- **Colori extra (facoltativi):** `colors.extra` contiene i colori con un ruolo preciso. Se mancano,
  vengono ricavati dalla palette.
  - `map-marker`: segnaposto delle fermate sulle mappe;
  - `highlight`: decorazioni di sfondo e fumetto della barra in basso;
  - `secondary-hover`: hover dei pulsanti col colore secondario;
  - `icon`: icone evidenziate.

  Nel CSS sono `var(--brand-<nome>)`, nel TypeScript `BRAND.colors.extra['<nome>']`.
- **Contatti e social:** sono facoltativi. Se mancano, i link (WhatsApp, Facebook, …) non vengono mostrati.
- **`forbiddenTerms`:** parole che non devono mai comparire nel codice, come nome, P.IVA o telefoni.
  Le usa `npm run check:brand`.
- **Commenti:** le chiavi che iniziano con `$` (es. `"$todo"`) sono commenti e vengono ignorate.
- **Validazione:** lo script controlla `brand.json` e la presenza di tutti gli asset. Se manca qualcosa, la build si ferma con l'elenco.

## Nel codice

- **TypeScript:** `import { BRAND, BRAND_VIEW, BRAND_PRIMARY } from '.../brand';` Nei template esponi
  `readonly brand = BRAND_VIEW;` e poi usa `brand.logo`, `brand.name`, `brand.contacts`, …
- **SCSS:** usa le variabili CSS globali:
  - `var(--brand-primary)` e `var(--brand-secondary)`;
  - `var(--brand-primary-300)` per una tonalità della palette;
  - `rgba(var(--brand-primary-rgb), 0.1)` per le trasparenze.
- **Immagini:** usa sempre il percorso `/assets/brand/<file>`.

## Il controllo

`npm run check:brand`, lanciato anche da `build-prod` e quindi in CI, fallisce se in `src/` trova:

- un termine di `forbiddenTerms` di qualsiasi brand;
- il dominio, la mail o i social di un brand;
- un colore delle palette, come `#xxxxxx` o `rgb()`;
- un asset del brand fuori da `/assets/brand/`.

Se un colore neutro usato nel codice coincide per caso con una tonalità di una palette, cambia di poco la tonalità nel `brand.json`.

## Aggiungere un brand

1. Copia `brands/test` in `brands/<nuovo>` e compila `brand.json` e `assets/`.
2. Associa il ramo in `branches.json`.
3. Prova in locale con `BRAND=<nuovo> npm start`.
4. Lancia `npm run check:brand`.
5. In CI aggiungi il ramo ai trigger, il tag Docker e il webhook di deploy (vedi `.forgejo/workflows/ci.yml` e `.gitlab-ci.yml`).
