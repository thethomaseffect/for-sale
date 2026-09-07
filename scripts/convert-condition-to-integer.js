const fs = require('fs-extra');
const path = require('path');

async function convertConditionToInteger() {
  try {
    const itemsJsonPath = path.join(__dirname, '../public/data/items.json');
    const itemsData = await fs.readJson(itemsJsonPath);
    
    let updated = 0;
    
    for (const item of itemsData.items) {
      let itemUpdated = false;
      
      // Convert condition to integer
      if (item.condition !== undefined && item.condition !== null) {
        if (item.condition === "" || item.condition === 0) {
          // Empty string or 0 means no condition - set to 0
          item.condition = 0;
          itemUpdated = true;
        } else {
          // Convert to integer
          const conditionNum = parseInt(item.condition, 10);
          if (!isNaN(conditionNum) && conditionNum !== item.condition) {
            item.condition = conditionNum;
            itemUpdated = true;
          } else if (typeof item.condition === 'string' && item.condition !== "") {
            // If it's a string, convert to number
            const num = parseInt(item.condition, 10);
            if (!isNaN(num)) {
              item.condition = num;
              itemUpdated = true;
            }
          }
        }
      } else {
        // If undefined or null, set to 0
        item.condition = 0;
        itemUpdated = true;
      }
      
      // Ensure qualityNotes is always a string (empty if not set)
      if (item.qualityNotes === undefined || item.qualityNotes === null) {
        item.qualityNotes = "";
        itemUpdated = true;
      }
      
      if (itemUpdated) {
        updated++;
      }
    }
    
    // Write back to file
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    
    console.log(`Updated ${updated} items to use integer conditions`);
    console.log(`Total items: ${itemsData.items.length}`);
    
  } catch (error) {
    console.error('Error updating items:', error);
    process.exit(1);
  }
}

convertConditionToInteger();

