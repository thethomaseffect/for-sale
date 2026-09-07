const fs = require('fs-extra');
const path = require('path');

const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const imagesDir = path.join(__dirname, '..', 'public', 'images');

// Subcategory IDs
const SUBCATEGORIES = {
    PS4: 'ps4',
    VITA: 'vita',
    '3DS': '3ds',
    SWITCH: 'switch'
};

// Try to use sharp if available
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('Note: sharp not available, will create manual categorization list');
}

async function detectPlatform(imagePath) {
    if (!sharp) {
        return null;
    }

    try {
        const fullPath = path.join(imagesDir, path.basename(imagePath));

        if (!await fs.pathExists(fullPath)) {
            return null;
        }

        const image = sharp(fullPath);
        const metadata = await image.metadata();

        // Ensure we have valid dimensions
        if (!metadata.width || !metadata.height || metadata.width < 10 || metadata.height < 10) {
            return null;
        }

        // Check top region for blue (PS4 indicator)
        // PS4 games typically have blue at the top
        const topWidth = metadata.width;
        const topHeight = Math.max(10, Math.floor(metadata.height * 0.3));
        const topRegion = await image
            .extract({
                left: 0,
                top: 0,
                width: topWidth,
                height: Math.min(topHeight, metadata.height)
            })
            .raw()
            .toBuffer();

        // Check for blue pixels at the top (high blue, low red/green)
        let bluePixelCount = 0;
        const topPixelCount = topRegion.length / 3;

        for (let i = 0; i < topRegion.length; i += 3) {
            const r = topRegion[i];
            const g = topRegion[i + 1];
            const b = topRegion[i + 2];
            // Check if pixel is blue (high blue, low red/green)
            // PS4 blue is typically around RGB(0, 100, 200) or similar
            if (b > 100 && b > r + 30 && b > g + 30) {
                bluePixelCount++;
            }
        }

        // If significant blue pixels at the top (more than 3% of pixels), likely PS4
        if (bluePixelCount > topPixelCount * 0.03) {
            return SUBCATEGORIES.PS4;
        }

        // Check right side for white (3DS indicator)
        // 3DS games typically have white on the right side
        const rightSideLeft = Math.floor(metadata.width * 0.75);
        const rightSideWidth = Math.min(Math.floor(metadata.width * 0.25), metadata.width - rightSideLeft);

        if (rightSideWidth >= 10 && metadata.height >= 10) {
            const rightSideRegion = await image
                .extract({
                    left: rightSideLeft,
                    top: 0,
                    width: rightSideWidth,
                    height: metadata.height
                })
                .raw()
                .toBuffer();

            // Check for white pixels on the right side (high values for all RGB)
            let whitePixelCount = 0;
            const rightPixelCount = rightSideRegion.length / 3;

            for (let i = 0; i < rightSideRegion.length; i += 3) {
                const r = rightSideRegion[i];
                const g = rightSideRegion[i + 1];
                const b = rightSideRegion[i + 2];
                // Check if pixel is white (high values for all RGB, close to each other)
                if (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
                    whitePixelCount++;
                }
            }

            // If significant white pixels on the right (more than 5% of pixels), likely 3DS
            if (whitePixelCount > rightPixelCount * 0.05) {
                return SUBCATEGORIES['3DS'];
            }
        }

        // Everything else defaults to Switch
        return SUBCATEGORIES.SWITCH;
    } catch (error) {
        console.error(`Error detecting platform for ${imagePath}:`, error.message);
        return null;
    }
}

async function categorizeVideoGames() {
    try {
        const itemsData = await fs.readJson(itemsJsonPath);
        const videoGameItems = itemsData.items.filter(item =>
            item.categories && item.categories.includes(1) && item.active !== false
        );

        console.log(`Found ${videoGameItems.length} video game items to categorize\n`);

        const results = [];
        const uncategorized = [];
        let processed = 0;

        for (const item of videoGameItems) {
            processed++;
            if (!item.images || item.images.length === 0) {
                console.warn(`[${processed}/${videoGameItems.length}] Item ${item.id} has no images`);
                uncategorized.push({ itemId: item.id, reason: 'No images' });
                continue;
            }

            const firstImage = item.images[0];
            const imagePath = firstImage.replace('/for-sale/images/', '');

            process.stdout.write(`[${processed}/${videoGameItems.length}] Analyzing item ${item.id}... `);

            // Try to detect platform using color analysis
            const platform = await detectPlatform(imagePath);

            if (platform) {
                // Always update subcategory (even if it exists, to ensure consistency)
                item.subcategory = platform;
                console.log(`✓ Categorized as ${platform}`);
                results.push({ itemId: item.id, subcategory: platform, image: imagePath });
            } else {
                // If detection fails, default to Switch
                item.subcategory = SUBCATEGORIES.SWITCH;
                console.log(`✓ Defaulted to Switch (detection failed)`);
                results.push({ itemId: item.id, subcategory: SUBCATEGORIES.SWITCH, image: imagePath });
            }
        }

        // Save updated items
        await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });

        // Count by subcategory
        const bySubcategory = {};
        results.forEach(r => {
            bySubcategory[r.subcategory] = (bySubcategory[r.subcategory] || 0) + 1;
        });

        console.log(`\n=== Summary ===`);
        console.log(`Total categorized: ${results.length}`);
        console.log(`\nBy subcategory:`);
        Object.keys(bySubcategory).sort().forEach(subcat => {
            console.log(`  ${subcat}: ${bySubcategory[subcat]}`);
        });

        if (uncategorized.length > 0) {
            console.log(`\nItems with issues: ${uncategorized.length}`);
            uncategorized.forEach(u => {
                console.log(`  Item ${u.itemId}: ${u.reason || 'Unknown issue'}`);
            });
        }

    } catch (error) {
        console.error('Error categorizing video games:', error);
        process.exit(1);
    }
}

categorizeVideoGames();

