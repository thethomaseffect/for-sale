const fs = require('fs-extra');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const mappingJsonPath = path.join(__dirname, '..', 'public', 'data', 'image-mapping.json');

// Parse item number and suffix from filename like "item-6-1x.jpg" or "item-40-1y.jpg"
function parseItemInfo(filename) {
  const match = filename.match(/^item-(\d+)-(\d+)([xy]?)\.jpg$/i);
  if (match) {
    const [, itemNum, photoNum, suffix] = match;
    return {
      originalItemNum: parseInt(itemNum),
      photoNum: parseInt(photoNum),
      suffix: suffix.toLowerCase() || '',
      filename
    };
  }
  return null;
}

async function regroupFromSuffixes() {
  try {
    // Read all image files
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(f => 
      (f.endsWith('.jpg') || f.endsWith('.JPG')) && 
      f !== '.gitkeep' &&
      f.startsWith('item-')
    );
    
    console.log(`Found ${imageFiles.length} item image files`);
    
    // Parse all files and group by item number + suffix
    const itemGroups = new Map(); // Key: "itemNum-suffix", Value: array of files
    
    for (const filename of imageFiles) {
      const info = parseItemInfo(filename);
      if (info) {
        const key = `${info.originalItemNum}-${info.suffix}`;
        if (!itemGroups.has(key)) {
          itemGroups.set(key, []);
        }
        itemGroups.get(key).push(info);
      } else {
        console.warn(`Warning: Could not parse ${filename}`);
      }
    }
    
    // Sort each group by photo number
    for (const [key, files] of itemGroups.entries()) {
      files.sort((a, b) => {
        // First sort by photo number
        if (a.photoNum !== b.photoNum) {
          return a.photoNum - b.photoNum;
        }
        // If same photo number, maintain original order by filename
        return a.filename.localeCompare(b.filename);
      });
    }
    
    // Create sorted list of groups (by original item number, then suffix)
    const sortedGroups = Array.from(itemGroups.entries())
      .sort(([keyA], [keyB]) => {
        const [itemNumA, suffixA] = keyA.split('-');
        const [itemNumB, suffixB] = keyB.split('-');
        const itemNumCompare = parseInt(itemNumA) - parseInt(itemNumB);
        if (itemNumCompare !== 0) return itemNumCompare;
        // Sort suffixes: '' < 'x' < 'y'
        const suffixOrder = { '': 0, 'x': 1, 'y': 2 };
        return (suffixOrder[suffixA] || 3) - (suffixOrder[suffixB] || 3);
      })
      .map(([key, files]) => files);
    
    console.log(`\nGrouped into ${sortedGroups.length} items`);
    
    // Show grouping info
    console.log('\nGrouping breakdown:');
    let groupNum = 1;
    for (const group of sortedGroups) {
      const firstItem = group[0];
      const key = `${firstItem.originalItemNum}-${firstItem.suffix || '(none)'}`;
      console.log(`  Item ${groupNum}: ${group.length} photos (from original item ${key})`);
      groupNum++;
    }
    
    // Load original mapping to preserve it
    let originalMapping = {};
    try {
      originalMapping = await fs.readJson(mappingJsonPath);
    } catch (e) {
      console.log('No existing mapping file found, will create new one');
    }
    
    // Rename files in two phases to avoid conflicts
    console.log('\nRenaming files (phase 1: to temporary names)...');
    const renameMap = new Map(); // Map from oldFilename to {tempFilename, newFilename}
    
    // Phase 1: Rename all files that need changing to temporary names
    for (let newItemId = 1; newItemId <= sortedGroups.length; newItemId++) {
      const group = sortedGroups[newItemId - 1];
      
      for (let photoNum = 1; photoNum <= group.length; photoNum++) {
        const oldFilename = group[photoNum - 1].filename;
        const newFilename = `item-${newItemId}-${photoNum}.jpg`;
        
        // Only rename if filename changed
        if (oldFilename !== newFilename) {
          const tempFilename = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
          const oldPath = path.join(imagesDir, oldFilename);
          const tempPath = path.join(imagesDir, tempFilename);
          await fs.move(oldPath, tempPath, { overwrite: false });
          renameMap.set(oldFilename, { tempFilename, newFilename });
        } else {
          // File already has correct name
          renameMap.set(oldFilename, { tempFilename: oldFilename, newFilename });
        }
      }
    }
    
    console.log('Renaming files (phase 2: to final names)...');
    const newMapping = {};
    const items = [];
    
    // Phase 2: Rename from temp names to final names
    for (let newItemId = 1; newItemId <= sortedGroups.length; newItemId++) {
      const group = sortedGroups[newItemId - 1];
      const imagePaths = [];
      
      for (let photoNum = 1; photoNum <= group.length; photoNum++) {
        const oldFilename = group[photoNum - 1].filename;
        const newFilename = `item-${newItemId}-${photoNum}.jpg`;
        
        // Get the temp filename (or original if it didn't change)
        const renameInfo = renameMap.get(oldFilename);
        const currentFilename = renameInfo ? renameInfo.tempFilename : oldFilename;
        
        const currentPath = path.join(imagesDir, currentFilename);
        const newPath = path.join(imagesDir, newFilename);
        
        // Rename to final name
        if (currentFilename !== newFilename) {
          await fs.move(currentPath, newPath, { overwrite: false });
        }
        
        // Get original filename from mapping if available
        const originalFilename = originalMapping[oldFilename] || oldFilename;
        newMapping[newFilename] = originalFilename;
        
        imagePaths.push(`/for-sale/images/${newFilename}`);
      }
      
      // Create item entry
      const item = {
        id: newItemId,
        categories: [1], // Default to Games category
        active: true,
        price: Math.floor(Math.random() * 500) + 50, // Random price 50-550 SEK
        images: imagePaths,
        en: {
          title: `Item ${newItemId}`,
          description: `This is item ${newItemId} with ${group.length} photo${group.length > 1 ? 's' : ''}. In good condition.`
        },
        sv: {
          title: `Artikel ${newItemId}`,
          description: `Detta är artikel ${newItemId} med ${group.length} foto${group.length > 1 ? 'n' : ''}. I gott skick.`
        }
      };
      
      items.push(item);
    }
    
    // Save new mapping file
    await fs.writeJson(mappingJsonPath, newMapping, { spaces: 2 });
    console.log(`Saved mapping file: ${mappingJsonPath}`);
    
    // Update items.json
    const itemsData = { items };
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    console.log(`Updated items.json with ${items.length} items`);
    
    console.log('\nDone!');
    console.log(`- Regrouped ${imageFiles.length} images into ${items.length} items`);
    console.log(`- Mapping updated to reflect new groupings`);
    
  } catch (error) {
    console.error('Error regrouping images:', error);
    process.exit(1);
  }
}

regroupFromSuffixes();

