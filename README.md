# For Sale

A static site for displaying items for sale, deployed to GitHub Pages.

## Features

- Multi-language support (English and Swedish)
- Category-based navigation
- Item listings with images
- Detailed item pages with image lightbox
- Price display in Swedish Krona (SEK)
- Terms and conditions section

## Development

### Prerequisites
- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Running locally

```bash
npm run dev
```

### Building

```bash
npm run build
```

This builds the app to `dist/`. A copy of `index.html` is written to `dist/404.html` so GitHub Pages can serve client-side routes.

## Deployment

The site is automatically deployed to GitHub Pages using GitHub Actions on every push to the `main` branch.

### GitHub Pages setup

1. Go to your repository settings
2. Navigate to "Pages" under "Settings"
3. Set the source to "GitHub Actions"

The site is served at `https://thethomaseffect.github.io/for-sale/`.

## Data files

All content is managed through JSON files:

- `public/data/content.json` - UI text and terms
- `public/data/categories.json` - Category definitions
- `public/data/items.json` - Item listings

All JSON files support multi-language content using country codes (e.g., `en`, `sv`).

## Adding items

1. Edit `public/data/items.json`
2. Add a new item with:
   - `id`: Unique integer
   - `categories`: Array of category IDs
   - `active`: `true` or `false` (set to `false` to hide)
   - `price`: Price in SEK
   - `images`: Array of image paths
   - `en` and `sv`: Language-specific content (title, description)

3. Place item images in `public/images/`

## License

See LICENSE file for details.
