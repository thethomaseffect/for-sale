const fs = require('fs-extra');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const mappingJsonPath = path.join(__dirname, '..', 'public', 'data', 'image-mapping.json');

// Parse timestamp from filename like "2025-10-29 12.00.25.jpg" or "2025-10-29 12.44.07_1.jpg"
function parseTimestamp(filename) {
  // Match pattern: YYYY-MM-DD HH.MM.SS.jpg or YYYY-MM-DD HH.MM.SS_1.jpg
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})(?:_\d+)?\.jpg$/i);
  if (match) {
    const [, date, hour, minute, second] = match;
    const timestamp = new Date(`${date}T${hour}:${minute}:${second}`);
    if (timestamp && !isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }
  return null;
}

// Group images by time proximity
// If gap is less than threshold (in seconds), they're the same item
function groupImages(images, thresholdSeconds = 60) {
  const groups = [];
  let currentGroup = [];
  let lastTimestamp = null;

  images.forEach((img) => {
    if (lastTimestamp === null) {
      currentGroup.push(img);
      lastTimestamp = img.timestamp;
    } else {
      const timeDiff = (img.timestamp - lastTimestamp) / 1000; // seconds
      
      if (timeDiff <= thresholdSeconds) {
        // Same group
        currentGroup.push(img);
        lastTimestamp = img.timestamp;
      } else {
        // New group
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [img];
        lastTimestamp = img.timestamp;
      }
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// Find the threshold that gives approximately targetGroups groups
function findOptimalThreshold(images, targetGroups) {
  let low = 10; // 10 seconds
  let high = 300; // 5 minutes
  let bestThreshold = 60;
  let bestDiff = Infinity;

  // Binary search for optimal threshold
  for (let i = 0; i < 20; i++) {
    const mid = Math.floor((low + high) / 2);
    const groups = groupImages(images, mid);
    const diff = Math.abs(groups.length - targetGroups);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestThreshold = mid;
    }

    if (groups.length > targetGroups) {
      // Need larger threshold (more grouping)
      low = mid + 1;
    } else {
      // Need smaller threshold (less grouping)
      high = mid - 1;
    }
  }

  return bestThreshold;
}

async function groupAndRenameImages() {
  try {
    // Read all image files
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(f => 
      (f.endsWith('.jpg') || f.endsWith('.JPG')) && 
      f !== '.gitkeep'
    );
    
    console.log(`Found ${imageFiles.length} image files`);
    
    // Parse timestamps and sort
    console.log('Parsing timestamps from filenames...');
    const imagesWithTimestamps = [];
    
    for (const filename of imageFiles) {
      const timestamp = parseTimestamp(filename);
      if (timestamp) {
        imagesWithTimestamps.push({ filename, timestamp });
      } else {
        console.warn(`Warning: Could not parse timestamp from ${filename}`);
      }
    }
    
    // Sort by timestamp
    const images = imagesWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    console.log(`Successfully parsed ${images.length} images`);
    
    // Analyze gaps to find optimal threshold for ~70 items
    const targetGroups = 70;
    console.log(`\nFinding optimal grouping threshold to get ~${targetGroups} items...`);
    
    const optimalThreshold = findOptimalThreshold(images, targetGroups);
    console.log(`Using threshold: ${optimalThreshold} seconds (${(optimalThreshold/60).toFixed(1)} minutes)`);
    
    // Group images
    const groups = groupImages(images, optimalThreshold);
    console.log(`Grouped into ${groups.length} items`);
    
    // Show some statistics
    const groupSizes = groups.map(g => g.length);
    const minSize = Math.min(...groupSizes);
    const maxSize = Math.max(...groupSizes);
    const avgSize = groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length;
    console.log(`Group sizes: min=${minSize}, max=${maxSize}, avg=${avgSize.toFixed(1)}`);
    
    // Show sample gaps
    console.log('\nSample time gaps (first 10):');
    for (let i = 1; i < Math.min(11, images.length); i++) {
      const gap = (images[i].timestamp - images[i-1].timestamp) / 1000;
      const sameGroup = gap <= optimalThreshold;
      console.log(`  ${gap.toFixed(1)}s ${sameGroup ? '(same item)' : '(NEW ITEM)'}`);
    }
    
    // Create mapping and rename files
    console.log('\nRenaming files and creating mapping...');
    const mapping = {};
    const items = [];
    
    for (let itemId = 1; itemId <= groups.length; itemId++) {
      const group = groups[itemId - 1];
      const imagePaths = [];
      
      for (let photoNum = 1; photoNum <= group.length; photoNum++) {
        const originalFilename = group[photoNum - 1].filename;
        const newFilename = `item-${itemId}-${photoNum}.jpg`;
        const originalPath = path.join(imagesDir, originalFilename);
        const newPath = path.join(imagesDir, newFilename);
        
        // Store mapping
        mapping[newFilename] = originalFilename;
        
        // Rename file
        await fs.move(originalPath, newPath, { overwrite: false });
        
        imagePaths.push(`/for-sale/images/${newFilename}`);
      }
      
      // Create item entry
      const item = {
        id: itemId,
        categories: [1], // Default to Games category
        active: true,
        price: Math.floor(Math.random() * 500) + 50, // Random price 50-550 SEK
        images: imagePaths,
        en: {
          title: `Item ${itemId}`,
          description: `This is item ${itemId} with ${group.length} photo${group.length > 1 ? 's' : ''}. In good condition.`
        },
        sv: {
          title: `Artikel ${itemId}`,
          description: `Detta är artikel ${itemId} med ${group.length} foto${group.length > 1 ? 'n' : ''}. I gott skick.`
        }
      };
      
      items.push(item);
    }
    
    // Save mapping file
    await fs.writeJson(mappingJsonPath, mapping, { spaces: 2 });
    console.log(`Saved mapping file: ${mappingJsonPath}`);
    
    // Update items.json
    const itemsData = { items };
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    console.log(`Updated items.json with ${items.length} items`);
    
    console.log('\nDone!');
    console.log(`- Renamed ${images.length} images`);
    console.log(`- Created ${items.length} items`);
    console.log(`- Mapping saved to image-mapping.json for undo capability`);
    
  } catch (error) {
    console.error('Error grouping and renaming images:', error);
    process.exit(1);
  }
}

groupAndRenameImages();

