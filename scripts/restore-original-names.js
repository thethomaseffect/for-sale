const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, '..', 'public', 'images');

async function restoreOriginalNames() {
  try {
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(f => f.toLowerCase().endsWith('.jpg'));
    
    console.log(`Found ${imageFiles.length} images to restore`);
    
    const restored = [];
    const failed = [];
    
    for (const filename of imageFiles) {
      const fullPath = path.join(imagesDir, filename);
      
      try {
        // Try to get timestamp from EXIF
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
          // Format as: YYYY-MM-DD HH.MM.SS.jpg
          const year = timestamp.getFullYear();
          const month = String(timestamp.getMonth() + 1).padStart(2, '0');
          const day = String(timestamp.getDate()).padStart(2, '0');
          const hours = String(timestamp.getHours()).padStart(2, '0');
          const minutes = String(timestamp.getMinutes()).padStart(2, '0');
          const seconds = String(timestamp.getSeconds()).padStart(2, '0');
          
          let newFilename = `${year}-${month}-${day} ${hours}.${minutes}.${seconds}.jpg`;
          let newPath = path.join(imagesDir, newFilename);
          
          // Check if target already exists (duplicate timestamp)
          if (await fs.pathExists(newPath)) {
            // Add a suffix to make it unique
            let counter = 1;
            let uniqueFilename = `${year}-${month}-${day} ${hours}.${minutes}.${seconds}_${counter}.jpg`;
            let uniquePath = path.join(imagesDir, uniqueFilename);
            
            while (await fs.pathExists(uniquePath)) {
              counter++;
              uniqueFilename = `${year}-${month}-${day} ${hours}.${minutes}.${seconds}_${counter}.jpg`;
              uniquePath = path.join(imagesDir, uniqueFilename);
            }
            
            newFilename = uniqueFilename;
            newPath = uniquePath;
          }
          
          // Only rename if different and doesn't already have timestamp format
          const alreadyTimestampFormat = filename.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}\.\d{2}\.\d{2}(?:_\d+)?\.jpg$/);
          if (filename !== newFilename && !alreadyTimestampFormat) {
            await fs.move(fullPath, newPath, { overwrite: false });
            console.log(`Restored: ${filename} -> ${newFilename}`);
            restored.push({ old: filename, new: newFilename });
          } else if (alreadyTimestampFormat) {
            console.log(`Already correct: ${filename}`);
          }
        } else {
          console.log(`No valid timestamp found for: ${filename}`);
          failed.push(filename);
        }
      } catch (error) {
        console.error(`Error processing ${filename}:`, error.message);
        failed.push(filename);
      }
    }
    
    console.log(`\nRestoration complete!`);
    console.log(`Restored: ${restored.length} files`);
    console.log(`Failed: ${failed.length} files`);
    
    if (failed.length > 0) {
      console.log(`\nFailed files:`);
      failed.forEach(f => console.log(`  - ${f}`));
    }
    
  } catch (error) {
    console.error('Error restoring original names:', error);
    process.exit(1);
  }
}

restoreOriginalNames();

