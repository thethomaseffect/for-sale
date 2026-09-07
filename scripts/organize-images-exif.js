const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');

// Since we lost the original filenames, we need to restore them first
// Let's check if git can help us restore the original timestamp-based filenames
async function restoreOriginalFilenames() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Check if we can restore from git
    const { stdout } = await execAsync('git status --porcelain public/images/', { cwd: path.join(__dirname, '..') });
    
    // If files are tracked, try to see original names
    // For now, let's assume user needs to restore original files or we use a different method
    console.log('Note: Original timestamp filenames needed for proper grouping.');
    console.log('If files were never committed with original names, please restore them first.');
    
    return false;
  } catch (error) {
    console.log('Git restore not available. Using file system timestamps (may be inaccurate).');
    return false;
  }
}

// Alternative: Create a script that user can run BEFORE renaming to save a mapping
// For now, let's use a more aggressive grouping approach with file stats

async function getFileTimestamp(filename, fullPath) {
  // Try to parse from filename first (original format)
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})(?:_\d+)?\.jpg$/);
  if (match) {
    const [, date, hour, minute, second] = match;
    const timestamp = new Date(`${date}T${hour}:${minute}:${second}`);
    return timestamp;
  }
  
  // If already renamed, try to get from EXIF data (most accurate)
  try {
    const exif = await exifr.parse(fullPath, { 
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
    });
    
    if (exif?.DateTimeOriginal) {
      return new Date(exif.DateTimeOriginal);
    }
    if (exif?.CreateDate) {
      return new Date(exif.CreateDate);
    }
    if (exif?.ModifyDate) {
      return new Date(exif.ModifyDate);
    }
  } catch (error) {
    // EXIF read failed, fall back to file stats
  }
  
  // Fallback to file system timestamps (least accurate)
  try {
    const stats = await fs.stat(fullPath);
    return stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
  } catch (error) {
    return null;
  }
}

async function organizeImages() {
  try {
    console.log('Attempting to organize images with 30-second grouping threshold...');
    console.log('Note: If files were already renamed, timestamps may be inaccurate.');
    console.log('Consider restoring original timestamp-based filenames for best results.\n');
    
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(f => f.toLowerCase().endsWith('.jpg'));
    
    console.log(`Found ${imageFiles.length} images`);
    
    // Get timestamps for all files
    const filesWithTimestamps = [];
    for (const filename of imageFiles) {
      const fullPath = path.join(imagesDir, filename);
      const timestamp = await getFileTimestamp(filename, fullPath);
      if (timestamp) {
        filesWithTimestamps.push({ filename, timestamp });
      }
    }
    
    // Sort by timestamp
    filesWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group by 30-second threshold
    const groups = [];
    let currentGroup = [];
    let lastTimestamp = null;
    
    for (const file of filesWithTimestamps) {
      if (lastTimestamp === null) {
        currentGroup.push(file);
        lastTimestamp = file.timestamp;
      } else {
        const timeDiff = (file.timestamp - lastTimestamp) / 1000; // seconds
        if (timeDiff <= 30) {
          currentGroup.push(file);
          lastTimestamp = file.timestamp;
        } else {
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
          }
          currentGroup = [file];
          lastTimestamp = file.timestamp;
        }
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    console.log(`Grouped into ${groups.length} items`);
    
    if (groups.length < 50) {
      console.log('\nWARNING: Only found', groups.length, 'items. This suggests file timestamps may be inaccurate.');
      console.log('To fix this, restore original timestamp-based filenames from git or backup.');
      console.log('Original filenames should be in format: "2025-10-29 12.00.25.jpg"\n');
    }
    
    // Rename and create items
    const items = [];
    let itemId = 1;
    
    for (const group of groups) {
      const imagePaths = [];
      
      for (let i = 0; i < group.length; i++) {
        const oldPath = path.join(imagesDir, group[i].filename);
        const newFilename = `item${itemId}-${i + 1}.jpg`;
        const newPath = path.join(imagesDir, newFilename);
        
        if (group[i].filename !== newFilename) {
          if (await fs.pathExists(newPath)) {
            await fs.remove(newPath);
          }
          await fs.move(oldPath, newPath, { overwrite: true });
        }
        
        imagePaths.push(`/for-sale/images/${newFilename}`);
      }
      
      const item = {
        id: itemId,
        categories: [1],
        active: true,
        price: Math.floor(Math.random() * 500) + 50,
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
    
    await fs.writeJson(itemsJsonPath, { items }, { spaces: 2 });
    console.log(`\nUpdated items.json with ${items.length} items`);
    console.log(`Oldest item has ID 1, newest item has ID ${items.length}`);
    
  } catch (error) {
    console.error('Error organizing images:', error);
    process.exit(1);
  }
}

organizeImages();

