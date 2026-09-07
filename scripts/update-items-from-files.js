const fs = require('fs-extra');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const categoriesJsonPath = path.join(__dirname, '..', 'public', 'data', 'categories.json');

const FULL_ITEM_RE = /^item-(\d+)-(\d+)\.(png|jpe?g|webp)$/i;

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

async function updateItemsFromFiles() {
  try {
    const files = await fs.readdir(imagesDir);
    const itemsMap = new Map();

    for (const file of files) {
      const match = file.match(FULL_ITEM_RE);
      if (!match) continue;
      const itemId = parseInt(match[1], 10);
      const photoNum = parseInt(match[2], 10);
      if (!itemsMap.has(itemId)) itemsMap.set(itemId, []);
      itemsMap.get(itemId).push({ photoNum, filename: file });
    }

    for (const photos of itemsMap.values()) {
      photos.sort((a, b) => a.photoNum - b.photoNum);
    }

    const existingData = await fs.readJson(itemsJsonPath);
    const categoriesData = await fs.readJson(categoriesJsonPath);
    const otherCategoryId = await getOtherCategoryId(categoriesData);
    const byId = new Map(existingData.items.map((item) => [item.id, item]));

    let updatedImages = 0;
    let added = 0;

    for (const [itemId, photos] of itemsMap.entries()) {
      const imagePaths = photos.map((p) => `/for-sale/images/${p.filename}`);
      if (byId.has(itemId)) {
        const item = byId.get(itemId);
        if (JSON.stringify(item.images || []) !== JSON.stringify(imagePaths)) {
          item.images = imagePaths;
          updatedImages++;
        }
      } else {
        byId.set(itemId, {
          id: itemId,
          categories: [otherCategoryId],
          active: true,
          price: 0,
          condition: 0,
          qualityNotes: { en: '', sv: '' },
          images: imagePaths,
          en: { title: '', description: '' },
          sv: { title: '', description: '' },
        });
        added++;
      }
    }

    const items = [...byId.values()].sort((a, b) => a.id - b.id);
    await fs.writeJson(itemsJsonPath, { items }, { spaces: 2 });

    console.log('Update complete.');
    console.log(`Items in JSON: ${items.length}`);
    console.log(`New stubs added: ${added}`);
    console.log(`Existing items with refreshed images[]: ${updatedImages}`);
    console.log('Items without matching files were left untouched.');
  } catch (error) {
    console.error('Error updating items:', error);
    process.exit(1);
  }
}

updateItemsFromFiles();
