# For Sale

A React + Vite static site for listing items for sale. Live at [https://thethomaseffect.github.io/for-sale/](https://thethomaseffect.github.io/for-sale/).

- English and Swedish (`?lang=sv`)
- Category listings with thumbnails
- Item pages with a full-size lightbox
- Prices in SEK

Content is JSON in `public/data/`. Photos live in `public/images/`.

## Development

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

The app is served at `http://127.0.0.1:5173/for-sale/` — the `/for-sale/` path is required (same as GitHub Pages).

```bash
npm run build      # output in dist/; also writes dist/404.html for SPA fallback
npm run preview    # preview the production build
```

Push to `main` deploys via GitHub Actions. In the repo, Pages source must be **GitHub Actions**.

## Data

| File | What it holds |
|---|---|
| `public/data/items.json` | Listings (title, description, price, images, condition) |
| `public/data/categories.json` | Categories and (for video games) subcategories |
| `public/data/conditions.json` | Condition scale 1–5 |
| `public/data/content.json` | UI chrome and terms |

Item titles shown in the UI are always English. Leave `sv.title` empty; fill `sv.description` (and `qualityNotes.sv`) when translating.

To hide a sold item, set `"active": false` in `items.json`. Keep the JSON and image files.

## Images

- Full photos: `public/images/item-{id}-{n}.jpg` (`n` starts at 1)
- Listing thumbnail: `public/images/item-{id}.jpg`
- `items.json` lists only the full photos, as `/for-sale/images/item-{id}-{n}.jpg`

## Adding items

1. Copy new photos into `public/images/` (phone names like `2025-10-29 12.00.25.jpg` are fine). Leave existing `item-*` files alone.
2. `npm run ingest-images` — groups shots taken close together, assigns new ids, renames files, and appends stubs in category Other.
3. `npm run optimize-images` — compresses photos and rebuilds thumbnails.
4. In `items.json`, set `en.title`, `price`, `condition`, `categories`, and `qualityNotes`. Leave `sv.title` empty.
5. Fill `en.description` (or run `node scripts/fetch-store-descriptions.js` for a Wikipedia blurb), then add `sv.description`.

If files are already named `item-{id}-{n}.jpg`, skip ingest and run `npm run sync-items` instead.

## License

[CC0 1.0](LICENSE).
