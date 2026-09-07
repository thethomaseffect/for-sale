const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');

// Parse timestamp from filename like "2025-10-29 12.00.25.jpg"
// or use EXIF data if already renamed
async function parseTimestamp(filename, fullPath) {
  // Try to parse from filename first (most reliable)
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})(?:_\d+)?\.jpg$/);
  if (match) {
    const [, date, hour, minute, second] = match;
    const timestamp = new Date(`${date}T${hour}:${minute}:${second}`);
    return { filename, timestamp, date, hour, minute, second };
  }
  
    // If already renamed, try to get from EXIF data (most accurate for photos)
  try {
    const exif = await exifr.parse(fullPath, { 
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
    });
    
    let timestamp = null;
    if (exif?.DateTimeOriginal) {
      timestamp = new Date(exif.DateTimeOriginal);
    } else if (exif?.CreateDate) {
      timestamp = new Date(exif.CreateDate);
    } else if (exif?.ModifyDate) {
      timestamp = new Date(exif.ModifyDate);
    }
    
    if (timestamp && timestamp.getTime() > 0 && !isNaN(timestamp.getTime())) {
      return { filename, timestamp, timestampSource: 'exif' };
    }
  } catch (error) {
    // EXIF read failed, continue to fallback
  }
  
  // Fallback to file system timestamps (least accurate)
  const stats = await fs.stat(fullPath);
  const timestamp = stats.birthtime && stats.birthtime.getTime() > 0 
    ? stats.birthtime 
    : stats.mtime;
  if (timestamp && timestamp.getTime() > 0 && !isNaN(timestamp.getTime())) {
    return { filename, timestamp, timestampSource: 'filesystem' };
  }
  return null;
}

// Group images by time proximity (within 30 seconds = same item)
function groupImages(images) {
  const groups = [];
  let currentGroup = [];
  let lastTimestamp = null;

  images.forEach((img, index) => {
    if (lastTimestamp === null) {
      currentGroup.push(img);
      lastTimestamp = img.timestamp;
    } else {
      const timeDiff = (img.timestamp - lastTimestamp) / 1000; // seconds
      
      if (timeDiff <= 30) {
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

async function organizeImages() {
  try {
    // Read all image files
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.JPG'));
    
    // Parse timestamps and sort
    console.log('Reading timestamps from images...');
    const imagesWithTimestamps = [];
    let exifCount = 0;
    let filenameCount = 0;
    let filesystemCount = 0;
    
    for (const filename of imageFiles) {
      const fullPath = path.join(imagesDir, filename);
      const result = await parseTimestamp(filename, fullPath);
      if (result && result.timestamp) {
        imagesWithTimestamps.push(result);
        // Track which method was used (for debugging)
        if (filename.match(/^\d{4}-\d{2}-\d{2}/)) filenameCount++;
        else if (result.timestampSource === 'exif') exifCount++;
        else filesystemCount++;
      }
    }
    
    const images = imagesWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`Found ${images.length} images (${filenameCount} from filename, ${exifCount} from EXIF, ${filesystemCount} from filesystem)`);
    
    // Group images
    const groups = groupImages(images);
    console.log(`Grouped into ${groups.length} items`);
    
    // Debug: show some sample timestamps and gaps
    if (images.length > 0) {
      console.log('\nSample timestamps (first 5):');
      for (let i = 0; i < Math.min(5, images.length); i++) {
        console.log(`  ${images[i].filename}: ${images[i].timestamp.toISOString()}`);
      }
      if (images.length > 10) {
        console.log('\nSample gaps between consecutive images (first 10):');
        for (let i = 1; i < Math.min(11, images.length); i++) {
          const gap = (images[i].timestamp - images[i-1].timestamp) / 1000;
          console.log(`  Gap ${i}: ${gap.toFixed(1)} seconds (${gap > 30 ? 'NEW ITEM' : 'same item'})`);
        }
      }
      console.log('');
    }
    
    // Rename images and create items
    const items = [];
    let itemId = 1;
    
    for (const group of groups) {
      const imagePaths = [];
      
      // Keep original filenames - no renaming needed
      for (let i = 0; i < group.length; i++) {
        imagePaths.push(`/for-sale/images/${group[i].filename}`);
      }
      
      // Create item entry
      const item = {
        id: itemId,
        categories: [1], // Default to Games category, can be changed manually
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
      itemId++;
    }
    
    // Update items.json
    const itemsData = { items };
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    
    console.log(`\nUpdated items.json with ${items.length} items`);
    console.log(`Oldest item has ID 1, newest item has ID ${items.length}`);
    
  } catch (error) {
    console.error('Error organizing images:', error);
    process.exit(1);
  }
}

organizeImages();

