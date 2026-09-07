const fs = require('fs-extra');
const path = require('path');

const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');

// Items to set to Video Games category (id 1)
const videoGamesItems = [
  44, 76, 80,
  907, 908, 909, 910, 911, 912, 913,
  930,
  1000, // Assuming user meant 1000, not 100 (item 100 doesn't exist)
  1001,
  1003, 1004, 1005
];

async function updateItemCategories() {
  try {
    // Read items.json
    const itemsData = await fs.readJson(itemsJsonPath);
    
    let updatedCount = 0;
    
    // Update categories for specified items
    for (const item of itemsData.items) {
      if (videoGamesItems.includes(item.id)) {
        item.categories = [1]; // Video Games category
        console.log(`Updated item ${item.id} to Video Games category`);
        updatedCount++;
      }
    }
    
    // Write updated items.json
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    console.log(`\nUpdated ${updatedCount} items to Video Games category`);
    
  } catch (error) {
    console.error('Error updating item categories:', error);
    process.exit(1);
  }
}

updateItemCategories();

