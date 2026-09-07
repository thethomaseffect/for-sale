const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.join(__dirname, '..', 'public', 'images');
const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');

// Instagram-like full images: 1080px on the longest side, JPEG ~80
const MAX_SIZE = 1080;
const JPEG_QUALITY = 80;

// Listing thumbnails from each item's first image (item-40-1.jpg → item-40.jpg)
const THUMB_MAX_SIZE = 640;
const THUMB_QUALITY = 70;

const FULL_IMAGE_RE = /^item-(\d+)-(\d+)\.(png|jpe?g|webp)$/i;
const THUMB_RE = /^item-(\d+)\.(png|jpe?g|webp)$/i;

function jpegOptions(quality) {
  return {
    quality,
    mozjpeg: true,
    chromaSubsampling: '4:2:0',
    progressive: true,
  };
}

function parseFullImage(filename) {
  const match = filename.match(FULL_IMAGE_RE);
  if (!match) return null;
  return {
    filename,
    itemId: match[1],
    photoNum: parseInt(match[2], 10),
    ext: match[3].toLowerCase(),
  };
}

async function writeJpeg(inputPath, outputPath, maxSize, quality) {
  const tempPath = `${outputPath}.tmp`;
  await sharp(inputPath)
    .rotate()
    .resize(maxSize, maxSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg(jpegOptions(quality))
    .toFile(tempPath);
  await fs.move(tempPath, outputPath, { overwrite: true });
}

async function optimizeImages() {
  try {
    const files = await fs.readdir(imagesDir);
    const fullImages = files.map(parseFullImage).filter(Boolean);

    console.log(`Found ${fullImages.length} item images in public/images`);

    if (fullImages.length === 0) {
      console.log('No item images found. Nothing to do.');
      return;
    }

    let resizedCount = 0;
    let skippedCount = 0;
    let totalOriginalSize = 0;
    let totalNewSize = 0;
    const extensionChanges = [];

    for (const image of fullImages) {
      const inputPath = path.join(imagesDir, image.filename);
      const outputFilename = `item-${image.itemId}-${image.photoNum}.jpg`;
      const outputPath = path.join(imagesDir, outputFilename);

      try {
        const originalStats = await fs.stat(inputPath);
        totalOriginalSize += originalStats.size;

        const metadata = await sharp(inputPath).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const longestSide = Math.max(width, height);
        const alreadyJpeg = metadata.format === 'jpeg';
        const alreadySized = longestSide <= MAX_SIZE;

        if (alreadyJpeg && alreadySized) {
          console.log(`Skipping ${image.filename} (already ${width}x${height} JPEG)`);
          skippedCount++;
          totalNewSize += originalStats.size;
          continue;
        }

        console.log(`Processing ${image.filename} (${width}x${height} ${metadata.format})...`);
        await writeJpeg(inputPath, outputPath, MAX_SIZE, JPEG_QUALITY);
        if (path.resolve(inputPath) !== path.resolve(outputPath)) {
          await fs.remove(inputPath);
        }

        const newStats = await fs.stat(outputPath);
        totalNewSize += newStats.size;
        resizedCount++;

        if (image.filename !== outputFilename) {
          extensionChanges.push({ from: image.filename, to: outputFilename });
        }

        const sizeReduction = ((originalStats.size - newStats.size) / originalStats.size * 100).toFixed(1);
        const newMeta = await sharp(outputPath).metadata();
        console.log(`  ✓ ${width}x${height} → ${newMeta.width}x${newMeta.height}, ${(originalStats.size / 1024).toFixed(0)}KB → ${(newStats.size / 1024).toFixed(0)}KB (${sizeReduction}% reduction)`);
      } catch (error) {
        console.error(`  ✗ Error processing ${image.filename}:`, error.message);
      }
    }

    // Thumbnails: always overwrite from the current first image of each item
    const imagesByItem = new Map();
    const currentFiles = await fs.readdir(imagesDir);
    for (const filename of currentFiles) {
      const parsed = parseFullImage(filename);
      if (!parsed) continue;
      if (!imagesByItem.has(parsed.itemId)) {
        imagesByItem.set(parsed.itemId, []);
      }
      imagesByItem.get(parsed.itemId).push(parsed);
    }

    console.log(`\nGenerating ${imagesByItem.size} thumbnails (always overwrite)...`);
    let thumbCount = 0;

    for (const [itemId, itemImages] of [...imagesByItem.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      itemImages.sort((a, b) => a.photoNum - b.photoNum);
      const first = itemImages.find(img => img.photoNum === 1) || itemImages[0];
      const sourcePath = path.join(imagesDir, first.filename);
      const thumbFilename = `item-${itemId}.jpg`;
      const thumbPath = path.join(imagesDir, thumbFilename);

      try {
        await writeJpeg(sourcePath, thumbPath, THUMB_MAX_SIZE, THUMB_QUALITY);
        const stats = await fs.stat(thumbPath);
        const meta = await sharp(thumbPath).metadata();
        console.log(`  ✓ ${thumbFilename} from ${first.filename} (${meta.width}x${meta.height}, ${(stats.size / 1024).toFixed(0)}KB)`);
        thumbCount++;
      } catch (error) {
        console.error(`  ✗ Error creating thumbnail for item ${itemId}:`, error.message);
      }
    }

    // Drop leftover thumbnail files that are not jpeg (e.g. old item-40.png thumbs)
    for (const filename of currentFiles) {
      const thumbMatch = filename.match(THUMB_RE);
      if (thumbMatch && !filename.toLowerCase().endsWith('.jpg')) {
        await fs.remove(path.join(imagesDir, filename));
        console.log(`  Removed old thumbnail ${filename}`);
      }
    }

    if (extensionChanges.length > 0 && await fs.pathExists(itemsJsonPath)) {
      console.log('\nUpdating items.json image paths...');
      const itemsData = await fs.readJson(itemsJsonPath);
      let updatedCount = 0;
      const renameMap = new Map(extensionChanges.map(({ from, to }) => [from, to]));

      for (const item of itemsData.items || []) {
        if (!Array.isArray(item.images)) continue;
        item.images = item.images.map((imagePath) => {
          const filename = path.basename(imagePath);
          const renamed = renameMap.get(filename);
          if (renamed) {
            updatedCount++;
            return imagePath.replace(filename, renamed);
          }
          return imagePath;
        });
      }

      await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
      console.log(`Updated ${updatedCount} image paths in items.json`);
    }

    console.log(`\nDone.`);
    console.log(`Full images resized: ${resizedCount}`);
    console.log(`Full images skipped: ${skippedCount}`);
    console.log(`Thumbnails written: ${thumbCount}`);
    console.log(`Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Total new size: ${(totalNewSize / 1024 / 1024).toFixed(2)}MB`);
    if (totalOriginalSize > 0) {
      console.log(`Overall size change: ${((totalNewSize - totalOriginalSize) / totalOriginalSize * 100).toFixed(1)}%`);
    }
  } catch (error) {
    console.error('Error optimizing images:', error);
    process.exit(1);
  }
}

optimizeImages();
