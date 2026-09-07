const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const mappingJsonPath = path.join(__dirname, '..', 'public', 'data', 'image-mapping.json');

// Configuration
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 90; // PNG compression quality (0-100, higher = better quality but larger file)

async function convertAndResizeImages() {
  try {
    // Read all JPG files
    const files = await fs.readdir(imagesDir);
    const jpgFiles = files.filter(f => 
      (f.endsWith('.jpg') || f.endsWith('.JPG')) && 
      f !== '.gitkeep'
    );
    
    console.log(`Found ${jpgFiles.length} JPG files to convert`);
    
    if (jpgFiles.length === 0) {
      console.log('No JPG files found. Nothing to do.');
      return;
    }
    
    const convertedFiles = [];
    let totalOriginalSize = 0;
    let totalNewSize = 0;
    
    // Convert and resize each image
    for (const jpgFile of jpgFiles) {
      const jpgPath = path.join(imagesDir, jpgFile);
      const pngFile = jpgFile.replace(/\.jpg$/i, '.png');
      const pngPath = path.join(imagesDir, pngFile);
      
      try {
        // Get original file size
        const originalStats = await fs.stat(jpgPath);
        totalOriginalSize += originalStats.size;
        
        console.log(`Processing ${jpgFile}...`);
        
        // Get image metadata
        const metadata = await sharp(jpgPath).metadata();
        const width = metadata.width;
        const height = metadata.height;
        
        // Calculate new dimensions while maintaining aspect ratio
        let newWidth = width;
        let newHeight = height;
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          newWidth = Math.round(width * ratio);
          newHeight = Math.round(height * ratio);
          console.log(`  Resizing from ${width}x${height} to ${newWidth}x${newHeight}`);
        } else {
          console.log(`  Keeping original size ${width}x${height}`);
        }
        
        // Convert to PNG and resize
        await sharp(jpgPath)
          .resize(newWidth, newHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ 
            quality: QUALITY,
            compressionLevel: 9 // Maximum compression
          })
          .toFile(pngPath);
        
        // Get new file size
        const newStats = await fs.stat(pngPath);
        totalNewSize += newStats.size;
        
        const sizeReduction = ((originalStats.size - newStats.size) / originalStats.size * 100).toFixed(1);
        console.log(`  ✓ Converted: ${(originalStats.size / 1024).toFixed(1)}KB → ${(newStats.size / 1024).toFixed(1)}KB (${sizeReduction}% ${sizeReduction > 0 ? 'reduction' : 'increase'})`);
        
        convertedFiles.push({ jpgFile, pngFile });
        
        // Delete original JPG file
        await fs.remove(jpgPath);
        console.log(`  ✓ Deleted original ${jpgFile}`);
        
      } catch (error) {
        console.error(`  ✗ Error processing ${jpgFile}:`, error.message);
      }
    }
    
    console.log(`\nConversion complete!`);
    console.log(`Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Total new size: ${(totalNewSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Overall size change: ${((totalNewSize - totalOriginalSize) / totalOriginalSize * 100).toFixed(1)}%`);
    
    // Update items.json
    console.log('\nUpdating items.json...');
    const itemsData = await fs.readJson(itemsJsonPath);
    let updatedCount = 0;
    
    for (const item of itemsData.items) {
      if (item.images && Array.isArray(item.images)) {
        for (let i = 0; i < item.images.length; i++) {
          if (item.images[i].endsWith('.jpg')) {
            item.images[i] = item.images[i].replace(/\.jpg$/, '.png');
            updatedCount++;
          }
        }
      }
    }
    
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    console.log(`Updated ${updatedCount} image paths in items.json`);
    
    // Update image-mapping.json
    console.log('\nUpdating image-mapping.json...');
    if (await fs.pathExists(mappingJsonPath)) {
      const mappingData = await fs.readJson(mappingJsonPath);
      const newMapping = {};
      let mappingUpdatedCount = 0;
      
      for (const [key, value] of Object.entries(mappingData)) {
        if (key.endsWith('.jpg')) {
          const newKey = key.replace(/\.jpg$/, '.png');
          newMapping[newKey] = value;
          mappingUpdatedCount++;
        } else {
          newMapping[key] = value;
        }
      }
      
      await fs.writeJson(mappingJsonPath, newMapping, { spaces: 2 });
      console.log(`Updated ${mappingUpdatedCount} entries in image-mapping.json`);
    } else {
      console.log('image-mapping.json not found, skipping...');
    }
    
    console.log('\nDone! All images converted to PNG and resized.');
    
  } catch (error) {
    console.error('Error converting images:', error);
    process.exit(1);
  }
}

convertAndResizeImages();

