const fs = require('fs-extra');
const path = require('path');

const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');

// Category mapping based on item IDs
const categoryMapping = {
  // Items 1-5: Books (2)
  1: 2, 2: 2, 3: 2, 4: 2, 5: 2,
  // Item 6: TTRPGs (3)
  6: 3,
  // Items 7-14: Comics and Graphic Novels (4)
  7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4, 13: 4, 14: 4,
  // Items 15-16: Artbooks and Compendiums (5)
  15: 5, 16: 5,
  // Item 17: Books (2)
  17: 2,
  // Item 18: Artbooks and Compendiums (5)
  18: 5,
  // Items 19, 20, 23, 24: TTRPGs (3)
  19: 3, 20: 3, 23: 3, 24: 3,
  // Items 21-22: Comics and Graphic Novels (4)
  21: 4, 22: 4,
  // Items 25-28: Artbooks and Compendiums (5)
  25: 5, 26: 5, 27: 5, 28: 5,
  // Item 29: Comics and Graphic Novels (4)
  29: 4,
  // Item 30: Manga (6)
  30: 6,
  // Items 31-32: Artbooks and Compendiums (5)
  31: 5, 32: 5,
  // Item 33: Electronics (7)
  33: 7,
  // Items 34-81: Video Games (1)
  34: 1, 35: 1, 36: 1, 37: 1, 38: 1, 39: 1, 40: 1, 41: 1,
  42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1, 49: 1,
  50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1,
  58: 1, 59: 1, 60: 1, 61: 1, 62: 1, 63: 1, 64: 1, 65: 1,
  66: 1, 67: 1, 68: 1, 69: 1, 70: 1, 71: 1, 72: 1, 73: 1,
  74: 1, 75: 1, 76: 1, 77: 1, 78: 1, 79: 1, 80: 1, 81: 1,
  // Items 82-85: Books (2)
  82: 2, 83: 2, 84: 2, 85: 2,
  // Items 86-87: Electronics (7)
  86: 7, 87: 7,
  // Item 88: Video Games (1)
  88: 1
};

async function updateItemCategories() {
  try {
    // Read items.json
    const itemsData = await fs.readJson(itemsJsonPath);
    
    // Update categories for each item
    for (const item of itemsData.items) {
      if (categoryMapping.hasOwnProperty(item.id)) {
        item.categories = [categoryMapping[item.id]];
        console.log(`Updated item ${item.id} to category ${categoryMapping[item.id]}`);
      } else {
        console.warn(`Warning: No category mapping for item ${item.id}`);
      }
    }
    
    // Write updated items.json
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    console.log(`\nUpdated items.json with new category assignments`);
    
  } catch (error) {
    console.error('Error updating item categories:', error);
    process.exit(1);
  }
}

updateItemCategories();

