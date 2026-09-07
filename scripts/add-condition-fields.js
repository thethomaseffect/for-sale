const fs = require('fs-extra');
const path = require('path');

async function addConditionFields() {
  try {
    const itemsJsonPath = path.join(__dirname, '../public/data/items.json');
    const itemsData = await fs.readJson(itemsJsonPath);
    
    let updated = 0;
    
    for (const item of itemsData.items) {
      let itemUpdated = false;
      
      // Add condition if missing or null (set to 0 - invalid condition, will be hidden)
      if (item.condition === undefined || item.condition === null || item.condition === "") {
        item.condition = 0;
        itemUpdated = true;
      } else if (typeof item.condition === 'string') {
        // Convert string to integer
        const num = parseInt(item.condition, 10);
        item.condition = isNaN(num) ? 0 : num;
        itemUpdated = true;
      }
      
      // Add qualityNotes if missing or null (set to empty string)
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
    
    console.log(`Updated ${updated} items with condition and qualityNotes fields`);
    console.log(`Total items: ${itemsData.items.length}`);
    
  } catch (error) {
    console.error('Error updating items:', error);
    process.exit(1);
  }
}

addConditionFields();

