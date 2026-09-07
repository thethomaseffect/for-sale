const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const categoriesJsonPath = path.join(__dirname, '..', 'public', 'data', 'categories.json');

const FULL_ITEM_RE = /^item-(\d+)-(\d+)\.(png|jpe?g|webp)$/i;
const THUMB_RE = /^item-(\d+)\.(png|jpe?g|webp)$/i;
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const FILENAME_TIME_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})(?:_\d+)?\.(png|jpe?g|webp)$/i;

const DEFAULT_GAP_SECONDS = 60;

function parseFilenameTimestamp(filename) {
  const match = filename.match(FILENAME_TIME_RE);
  if (!match) return null;
  const [, date, hour, minute, second] = match;
  const timestamp = new Date(`${date}T${hour}:${minute}:${second}`);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

async function getPhotoTime(filename, fullPath) {
  const fromName = parseFilenameTimestamp(filename);
  if (fromName) return { timestamp: fromName, source: 'filename' };

  try {
    const exif = await exifr.parse(fullPath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    });
    const raw = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;
    if (raw) {
      const timestamp = new Date(raw);
      if (!Number.isNaN(timestamp.getTime())) {
        return { timestamp, source: 'exif' };
      }
    }
  } catch (_) {
    // No usable EXIF
  }

  const stats = await fs.stat(fullPath);
  return { timestamp: stats.mtime, source: 'mtime' };
}

function groupByProximity(photos, gapSeconds) {
  const sorted = [...photos].sort((a, b) => a.timestamp - b.timestamp);
  const groups = [];
  let current = [];
  let last = null;

  for (const photo of sorted) {
    if (last === null || (photo.timestamp - last) / 1000 <= gapSeconds) {
      current.push(photo);
    } else {
      groups.push(current);
      current = [photo];
    }
    last = photo.timestamp;
  }
  if (current.length) groups.push(current);
  return groups;
}

function parseGapArg() {
  const arg = process.argv.find((a) => a.startsWith('--gap='));
  if (!arg) return DEFAULT_GAP_SECONDS;
  const value = parseInt(arg.slice('--gap='.length), 10);
  return Number.isNaN(value) || value < 1 ? DEFAULT_GAP_SECONDS : value;
}

function emptyItem(id, otherCategoryId, imagePaths) {
  return {
    id,
    categories: [otherCategoryId],
    active: true,
    price: 0,
    condition: 0,
    qualityNotes: { en: '', sv: '' },
    images: imagePaths,
    en: { title: '', description: '' },
    sv: { title: '', description: '' },
  };
}

async function getOtherCategoryId(categoriesData) {
  const existing = categoriesData.categories.find((c) => c.en?.name === 'Other');
  if (existing) return existing.id;
  const nextId = Math.max(...categoriesData.categories.map((c) => c.id)) + 1;
  categoriesData.categories.push({
    id: nextId,
    en: { name: 'Other', description: 'Other items' },
    sv: { name: 'Övrigt', description: 'Övriga artiklar' },
    icon: '📦',
  });
  await fs.writeJson(categoriesJsonPath, categoriesData, { spaces: 2 });
  console.log(`Added "Other" category with id ${nextId}`);
  return nextId;
}

async function ingestNewImages() {
  const gapSeconds = parseGapArg();
  const files = await fs.readdir(imagesDir);
  const incoming = files.filter((f) => {
    if (f === '.gitkeep') return false;
    if (!IMAGE_RE.test(f)) return false;
    if (FULL_ITEM_RE.test(f) || THUMB_RE.test(f)) return false;
    return true;
  });

  if (incoming.length === 0) {
    console.log('No new images to ingest (only item-{id}-{n} files and thumbnails found).');
    console.log('Drop camera/phone photos into public/images/ then re-run.');
    return;
  }

  console.log(`Found ${incoming.length} new image(s). Grouping shots within ${gapSeconds}s as the same item.`);

  const photos = [];
  for (const filename of incoming) {
    const fullPath = path.join(imagesDir, filename);
    const { timestamp, source } = await getPhotoTime(filename, fullPath);
    photos.push({ filename, fullPath, timestamp, source });
    console.log(`  ${filename}  ${timestamp.toISOString()}  (${source})`);
  }

  const groups = groupByProximity(photos, gapSeconds);
  const itemsData = await fs.readJson(itemsJsonPath);
  const categoriesData = await fs.readJson(categoriesJsonPath);
  const otherCategoryId = await getOtherCategoryId(categoriesData);

  const existingIds = itemsData.items.map((item) => item.id);
  const fileIds = files
    .map((f) => {
      const match = f.match(FULL_ITEM_RE);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(Boolean);
  let nextId = Math.max(0, ...existingIds, ...fileIds) + 1;

  const added = [];

  for (const group of groups) {
    const itemId = nextId++;
    const imagePaths = [];

    for (let i = 0; i < group.length; i++) {
      const photo = group[i];
      const destName = `item-${itemId}-${i + 1}${path.extname(photo.filename).toLowerCase()}`;
      const destPath = path.join(imagesDir, destName);
      if (await fs.pathExists(destPath)) {
        throw new Error(`Refusing to overwrite existing ${destName}`);
      }
      await fs.move(photo.fullPath, destPath);
      imagePaths.push(`/for-sale/images/${destName}`);
      console.log(`  ${photo.filename} → ${destName}`);
    }

    itemsData.items.push(emptyItem(itemId, otherCategoryId, imagePaths));
    added.push({ itemId, photos: imagePaths.length });
  }

  itemsData.items.sort((a, b) => a.id - b.id);
  await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });

  console.log(`\nIngested ${added.length} new item(s) into category Other (${otherCategoryId}):`);
  for (const row of added) {
    console.log(`  id ${row.itemId}  (${row.photos} photo${row.photos === 1 ? '' : 's'})`);
  }
  console.log('\nNext:');
  console.log('  1. npm run optimize-images');
  console.log('  2. Set en.title, price, condition, categories in items.json');
  console.log('  3. node scripts/fetch-store-descriptions.js  (or paste a Wikipedia blurb)');
  console.log('  4. Add sv.description');
}

ingestNewImages().catch((error) => {
  console.error('Error ingesting images:', error);
  process.exit(1);
});
