const fs = require('fs-extra');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const categoriesJsonPath = path.join(__dirname, '..', 'public', 'data', 'categories.json');

async function updateItemsFromFiles() {
  try {
    // Read all item-*.jpg / item-*.png files (ignore thumbnails like item-40.jpg)
    const files = await fs.readdir(imagesDir);
    const itemFiles = files.filter(f => /^item-\d+-\d+\.(png|jpe?g|webp)$/i.test(f));
    
    // Group files by item ID
    const itemsMap = new Map();
    for (const file of itemFiles) {
      const match = file.match(/^item-(\d+)-(\d+)\.(png|jpe?g|webp)$/i);
      if (match) {
        const itemId = parseInt(match[1]);
        const photoNum = parseInt(match[2]);
        
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, []);
        }
        itemsMap.get(itemId).push({ photoNum, filename: file });
      }
    }
    
    // Sort photos by photo number for each item
    for (const [itemId, photos] of itemsMap.entries()) {
      photos.sort((a, b) => a.photoNum - b.photoNum);
    }
    
    // Get existing items.json
    const existingData = await fs.readJson(itemsJsonPath);
    const existingItems = new Map();
    existingData.items.forEach(item => {
      existingItems.set(item.id, item);
    });
    
    // Get existing categories
    const categoriesData = await fs.readJson(categoriesJsonPath);
    const maxCategoryId = Math.max(...categoriesData.categories.map(c => c.id));
    
    // Add "Other" category if it doesn't exist
    let otherCategoryId = categoriesData.categories.find(c => c.en.name === 'Other')?.id;
    if (!otherCategoryId) {
      otherCategoryId = maxCategoryId + 1;
      categoriesData.categories.push({
        id: otherCategoryId,
        en: {
          name: 'Other',
          description: 'Other items'
        },
        sv: {
          name: 'Övrigt',
          description: 'Övriga artiklar'
        },
        icon: '📦'
      });
      await fs.writeJson(categoriesJsonPath, categoriesData, { spaces: 2 });
      console.log(`Added "Other" category with id ${otherCategoryId}`);
    }
    
    // Build new items array
    const allItemIds = Array.from(itemsMap.keys()).sort((a, b) => a - b);
    const newItems = [];
    
    for (const itemId of allItemIds) {
      const photos = itemsMap.get(itemId);
      const imagePaths = photos.map(p => `/for-sale/images/${p.filename}`).sort();
      
      // Check if item already exists
      if (existingItems.has(itemId)) {
        const existingItem = existingItems.get(itemId);
        // Update image paths to match actual files
        existingItem.images = imagePaths;
        newItems.push(existingItem);
      } else {
        // Create new item in "Other" category
        const photoCount = photos.length;
        newItems.push({
          id: itemId,
          categories: [otherCategoryId],
          active: true,
          price: Math.floor(Math.random() * 500) + 50, // Random price 50-550 SEK
          images: imagePaths,
          en: {
            title: `Item ${itemId}`,
            description: `This is item ${itemId} with ${photoCount} photo${photoCount > 1 ? 's' : ''}. In good condition.`
          },
          sv: {
            title: `Artikel ${itemId}`,
            description: `Detta är artikel ${itemId} med ${photoCount} foto${photoCount > 1 ? 'n' : ''}. I gott skick.`
          }
        });
      }
    }
    
    // Sort items by ID
    newItems.sort((a, b) => a.id - b.id);
    
    // Write updated items.json
    await fs.writeJson(itemsJsonPath, { items: newItems }, { spaces: 2 });
    
    const existingCount = existingItems.size;
    const newCount = allItemIds.length - existingCount;
    const updatedCount = newItems.filter(item => existingItems.has(item.id) && 
      JSON.stringify(item.images) !== JSON.stringify(existingItems.get(item.id).images)).length;
    
    console.log(`\nUpdate complete!`);
    console.log(`Total items: ${allItemIds.length}`);
    console.log(`Existing items: ${existingCount}`);
    console.log(`New items added: ${newCount}`);
    console.log(`Items with updated images: ${updatedCount}`);
    console.log(`All new items assigned to "Other" category (id ${otherCategoryId})`);
    
  } catch (error) {
    console.error('Error updating items:', error);
    process.exit(1);
  }
}

updateItemsFromFiles();

