# CLAUDE.md

Guidance for agents working in this repository.

This is a **React + Vite static site** that lists items for sale. Content is JSON in `public/data/`. Photos live in `public/images/`. It deploys to GitHub Pages at `https://thethomaseffect.github.io/for-sale/`.

## Stack and commands

- Node 20+, npm
- React 18, React Router 6, Vite 5
- Root `package.json` is **CommonJS** (no `"type": "module"`) so `scripts/*.js` can use `require()`. Vite still loads `vite.config.js` as ESM.
- `npm install`
- `npm run dev` — Vite at `http://127.0.0.1:5173/for-sale/` (the `/for-sale/` path is required)
- `npm run build` — output `dist/`; copies `index.html` → `dist/404.html` for GitHub Pages SPA fallback
- `npm run preview` — preview the production build (also under `/for-sale/`)
- `npm run ingest-images` — rename new photos and append item stubs (see Images)
- `npm run optimize-images` — compress photos + regenerate thumbnails
- `npm run sync-items` — refresh `images[]` from files already named `item-{id}-{n}.*`

## GitHub Pages paths (easy to break)

The GitHub repo is `thethomaseffect/for-sale`, so the site is a **project Pages** site, not a domain root.

These two values must stay in sync:

- `vite.config.js` → `base: '/for-sale/'`
- `src/main.jsx` → `<BrowserRouter basename="/for-sale">`

JSON image paths are stored as `/for-sale/images/item-N-M.jpg`. The UI does **not** use those strings as raw `src`. It strips `/for-sale/images/` and prefixes `import.meta.env.BASE_URL` so local dev and Pages both work.

All data fetches use `import.meta.env.BASE_URL` as well, e.g. `${import.meta.env.BASE_URL}data/items.json`.

The Vite plugin `githubPagesSpaFallback` copies `dist/index.html` to `dist/404.html` after build. Direct loads of `/for-sale/item/908` only work on Pages because of that file. Do not remove it.

Deploy: `.github/workflows/deploy.yml` on push to `main` → `npm install` → `npm run build` → upload `./dist` → `actions/deploy-pages`. Pages source must be GitHub Actions.

## App structure

```
src/main.jsx                 Router basename
src/App.jsx                  Language context, nav, routes
src/pages/Home.jsx           Category grid
src/pages/CategoryPage.jsx   Item cards (thumbnails), subcategory filters, scroll restore
src/pages/ItemDetail.jsx     Full images + lightbox
src/components/Lightbox.jsx  Full-size gallery overlay
public/data/*.json           All editable content
public/images/               JPEGs + thumbnails
scripts/                     Maintenance scripts (ingest, optimize, Wikipedia, sync)
```

Routes:

- `/` — categories
- `/category/:categoryId` — listings; optional `?subcategory=ps4`
- `/item/:itemId` — detail

Query params:

- `lang=sv` for Swedish. English is the default and **omits** `lang` from the URL.
- `usePreserveLanguage()` appends `lang` when building internal links. Always use it for `<Link to>` so Swedish users do not snap back to English.

`history.scrollRestoration` is set to `manual` in `App.jsx`. Category pages persist scroll in `sessionStorage` under `category-{id}-{subcategory|all}-scroll`. That logic is fragile; do not “simplify” it unless you re-test back-button + subcategory switching + the desktop sticky header.

Desktop (≥769px): the category header is `position: fixed` under the 60px navbar. A spacer div’s height is set in JS from the header’s actual height. Mobile: header scrolls normally.

## Language and titles

UI chrome (nav, terms, back links) comes from `public/data/content.json` (`en` / `sv`). Edit those strings directly; there is no generator.

**Item titles always prefer English** in `CategoryPage` and `ItemDetail` (`getItemTitle`). Swedish `title` is ignored unless English is missing, and placeholders like `Artikel 12` are skipped. Many `sv.title` fields are `""` on purpose. Descriptions do use the active language (`item[language] || item.en`).

When adding translations, fill `sv.description` (and `qualityNotes.sv`). Do not invent Swedish titles unless asked; the listing is meant to stay on the English product name.

## English descriptions (Wikipedia)

English blurbs come from **English Wikipedia** and are saved onto `item.en.description`.

Script: `node scripts/fetch-store-descriptions.js`

It walks **every `active !== false` item** (2s delay between requests):

1. Take `item.en.title`. Skip if missing.
2. Search Wikipedia OpenSearch with several query variants: raw title, title minus “Volume N” / parentheticals, and title plus the English category name (e.g. `Video Games`).
3. Fetch the first hit via the MediaWiki API (`prop=extracts&exintro=true&explaintext=true`).
4. If the API extract is empty, scrape the HTML article with `unfluff`.
5. Keep the first paragraph, or more if a later paragraph mentions the category/media type. Strip `[1]` citations and “From Wikipedia…” boilerplate.
6. **Overwrite** `item.en.description` whenever a blurb ≥ ~50 characters is found, then write `items.json`.

It does **not** write Swedish. It does **not** skip items that already have a description, so a full run can clobber hand-edited English copy. Prefer running it only for new items (temporarily narrow the loop, or paste a Wikipedia extract by hand). The first five items log extra DEBUG lines.

## Swedish translations

Swedish lives in the JSON and is maintained by whoever is editing. There is no translation script.

| Field | How it is translated |
|---|---|
| `content.json` | Hand-written `en` / `sv` pairs |
| `categories.json` / `conditions.json` | Hand-written `en` / `sv` `name` (and descriptions) |
| `item.en.description` | Wikipedia (script or paste) |
| `item.sv.description` | Human/LLM translation of the English description into natural Swedish. Keep product names, platforms, and titles in English where that is normal in Swedish (e.g. game names). |
| `item.sv.title` | Leave `""`. The UI shows the English title. |
| `qualityNotes` | Object `{ en, sv }`. Empty string in both languages hides the note. |

When adding or refreshing an item:

1. Set a good English title (this is what Wikipedia search and the listing use).
2. Fill `en.description` (Wikipedia script or write it).
3. Translate that text into `sv.description` in the same edit. Do not leave Swedish as a stiff calque if you can make it read like a native listing.
4. Translate `qualityNotes` the same way.

UI language is `?lang=sv`. English is default and omits the query param. Always use `addLanguageToPath()` on in-app links.

## Data files

### `public/data/items.json`

Array at `items`. Typical item:

```json
{
  "id": 1,
  "categories": [2],
  "active": true,
  "price": 200,
  "condition": 4,
  "subcategory": "ps4",
  "qualityNotes": { "en": "...", "sv": "..." },
  "images": [
    "/for-sale/images/item-1-1.jpg",
    "/for-sale/images/item-1-2.jpg"
  ],
  "en": { "title": "...", "description": "..." },
  "sv": { "title": "", "description": "..." }
}
```

Rules:

- `id` is a unique integer. IDs are **not dense** (games, books, 900s board games, 1000s electronics, etc.). New items should use a free id; do not renumber existing ones (filenames include the id).
- `categories` is an array of category ids from `categories.json`. Listings match `item.categories.includes(categoryId)`. Item-detail “back” uses `categories[0]` only.
- `active: false` hides the item from category grids. Direct `/item/:id` URLs still render (no active check on the detail page).
- `price` is SEK, shown as `{price} SEK`.
- `condition` is an integer **1–5** (`conditions.json`). Invalid/missing → no condition block. Id 5 (“Acceptable”) gets a different CSS class.
- `qualityNotes` is `{ en, sv }`. Empty strings hide the notes paragraph.
- `subcategory` is optional, string id (e.g. `"ps4"`, `"3ds"`, `"switch"`, `"vita"`). Only category 1 (Video Games) currently has subcategories. Filters use `?subcategory=`.

To mark something sold / not for sale: set `"active": false`. Do not delete the item or its images unless asked.

### `public/data/categories.json`

`categories[]` with numeric `id`, `en`/`sv` `{ name, description }`, `icon` emoji, optional `subcategories[]` with string `id`.

Current ids: 1 Video Games, 2 Books, 3 TTRPGs, 4 Comics, 5 Artbooks, 6 Manga, 7 Electronics, 8 Other, 9 Board Games.

### `public/data/conditions.json`

1 New, 2 Like New, 3 Very Good, 4 Good, 5 Acceptable.

### `public/data/content.json`

Site-wide copy including terms: Swish after meeting in Stockholm; buyer pays delivery; all sales final.

## Images

### Naming

- Full photos: `public/images/item-{id}-{n}.jpg` where `n` starts at 1.
- Thumbnail (listing only): `public/images/item-{id}.jpg` — **no** `-{n}` suffix.
- `items.json` lists **only** full photos, never the thumbnail file.

Example: `item-908-1.jpg` + `item-908-2.jpg` on the item page; category cards load `item-908.jpg`.

### Pipeline

`npm run optimize-images` (`scripts/resize-png-images.js`) is the image optimizer.

1. Scans `public/images` for `item-{id}-{n}.{png|jpg|jpeg|webp}`. Ignores thumbnails (`item-{id}.jpg`).
2. Converts/resizes full images to JPEG, longest side **1080px**, quality **80**, mozjpeg, 4:2:0, progressive.
3. **Skips** a full image if it is already JPEG and already ≤1080 on the long side.
4. Writes thumbnail `item-{id}.jpg` from photo **`-1`** (else lowest `n`). Max side **640px**, quality **70**. **Always overwrites** thumbnails so a new first photo is picked up.
5. If a full image was renamed `.png` → `.jpg`, updates matching paths in `items.json`.

After dropping new originals into `public/images/`, run `npm run optimize-images` before committing.

If you reorder photos, rename files so the new hero is `item-{id}-1.jpg` (and bump the others), update `items.json` `images[]` order to match, then re-run the optimizer so the thumbnail is rebuilt.

### UI loading

- Category cards: `getThumbnailPath(item.images[0])` turns `item-40-1.jpg` into `item-40.jpg`.
- Item page and lightbox: full `item.images[]` via `normalizeImagePath`.
- `normalizeImagePath` is duplicated in CategoryPage, ItemDetail, and Lightbox. Keep the `/for-sale/images/` strip + `BASE_URL` behavior if you touch it.

Cards are ~300px wide × 250px tall (`object-fit: cover`). Thumbnails at 640px cover 2x retina.

## Scripts

All scripts are CommonJS and resolve `public/data/…` from the **repo root**.

| Command | Purpose |
|---|---|
| `npm run ingest-images` (`scripts/ingest-new-images.js`) | Rename **new** camera/phone dumps in `public/images/` to `item-{id}-{n}.*` and **append** stubs to `items.json`. Does not touch existing `item-*` files or rewrite the catalog. Optional `--gap=60` (seconds between shots that count as the same item). |
| `npm run optimize-images` (`scripts/resize-png-images.js`) | Compress photos + regenerate thumbnails |
| `npm run sync-items` (`scripts/update-items-from-files.js`) | Refresh `images[]` on existing items from `item-{id}-{n}.*` on disk; **append** stubs for new ids. Never deletes JSON items. |
| `node scripts/fetch-store-descriptions.js` | Wikipedia → `item.en.description` (overwrites existing English blurbs) |
| `node scripts/list-items-alphabetical.js` | Print active items and whether they have a long English description |

`devDependencies` used only by scripts: `sharp`, `unfluff`, `fs-extra`, `exifr`. They are not in the production bundle.

## Workflows

**Hide sold items:** set `active` to `false` in `items.json` for those ids. Keep files.

**Add an item (camera dump):**

1. Copy new photos into `public/images/` (leave existing `item-*` files alone). Phone names like `2025-10-29 12.00.25.jpg` are fine.
2. `npm run ingest-images` — groups shots taken close together, assigns ids after the current max, renames to `item-{id}-{n}.*`, appends stubs in category Other with `price: 0` and empty titles.
3. `npm run optimize-images`.
4. In `items.json`, set `en.title`, `price`, `condition`, `categories`, and `qualityNotes` as needed. Leave `sv.title` empty.
5. `node scripts/fetch-store-descriptions.js` (or paste a Wikipedia blurb into `en.description`), then write `sv.description`.
6. Spot-check `/category/{id}` (thumbnail) and `/item/{id}` (full images).

If files are already named `item-{id}-{n}.jpg`, skip ingest and run `npm run sync-items` instead so JSON gets the new stubs/paths.

**Verify UI:** if you change listing, routing, or images, check home → a category → subcategory (games) → item → back (scroll should restore on desktop). Confirm category cards request `item-N.jpg` and the item page requests `item-N-1.jpg`.

## License

CC0 1.0 (`LICENSE`).
