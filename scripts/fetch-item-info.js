const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');

const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const categoriesJsonPath = path.join(__dirname, '..', 'public', 'data', 'categories.json');

// Rate limiting - wait between requests
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds
const MAX_RETRIES = 3;

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            ...options
        };
        
        const req = protocol.get(url, requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Search for item description on Wikipedia
async function searchForItem(title, categoryName, subcategoryName, debug = false) {
    try {
        // Use Wikipedia search API to find pages - this will return suggestions even if title doesn't match exactly
        const searchQuery = title;
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery.replace(/\s+/g, '_'))}`;
        
        if (debug) {
            console.log(`    DEBUG: Searching Wikipedia for: "${searchQuery}"`);
            console.log(`    DEBUG: URL: ${searchUrl}`);
        }
        
        try {
            // First try direct page lookup
            const response = await makeRequest(searchUrl);
            const data = JSON.parse(response);
            
            if (data.extract && data.extract.length > 30) {
                if (debug) {
                    console.log(`    DEBUG: Found direct match (${data.extract.length} chars)`);
                }
                return data.extract;
            }
        } catch (error) {
            // If direct lookup fails, use OpenSearch API to get suggestions
            if (debug) {
                console.log(`    DEBUG: Direct lookup failed, trying OpenSearch API...`);
            }
            
            const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchQuery)}&limit=3&format=json`;
            const searchResponse = await makeRequest(searchApiUrl);
            const searchData = JSON.parse(searchResponse);
            
            if (debug) {
                console.log(`    DEBUG: OpenSearch response: ${JSON.stringify(searchData).substring(0, 200)}...`);
            }
            
            // OpenSearch returns: [query, [titles], [descriptions], [urls]]
            if (searchData && searchData.length >= 2 && searchData[1].length > 0) {
                const firstTitle = searchData[1][0];
                
                if (debug) {
                    console.log(`    DEBUG: Search returned ${searchData[1].length} results`);
                    console.log(`    DEBUG: Using first result: "${firstTitle}"`);
                }
                
                // Get the summary for the first result
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle.replace(/\s+/g, '_'))}`;
                const summaryResponse = await makeRequest(summaryUrl);
                const summaryData = JSON.parse(summaryResponse);
                
                if (summaryData.extract && summaryData.extract.length > 30) {
                    if (debug) {
                        console.log(`    DEBUG: Found description (${summaryData.extract.length} chars)`);
                    }
                    return summaryData.extract;
                }
            } else if (debug) {
                console.log(`    DEBUG: OpenSearch returned no results`);
            }
        }
        
        return null;
    } catch (error) {
        if (debug) {
            console.log(`    DEBUG: Error: ${error.message}`);
        }
        return null;
    }
}

// Delay helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchItemInfo() {
    try {
        // Load categories data
        const categoriesData = await fs.readJson(categoriesJsonPath);
        const categoriesMap = new Map();
        categoriesData.categories.forEach(cat => {
            categoriesMap.set(cat.id, cat);
        });
        
        const itemsData = await fs.readJson(itemsJsonPath);
        const allItems = itemsData.items.filter(item => item.active !== false);
        const items = allItems.slice(0, 10); // Limit to first 10 items
        
        console.log(`Found ${allItems.length} active items, processing first ${items.length}\n`);
        console.log('Note: This script will fetch descriptions for each item.');
        console.log('Due to rate limits, this may take a while...\n');
        
        let processed = 0;
        let updated = 0;
        let skipped = 0;
        let descriptionsFound = 0;
        
        for (const item of items) {
            processed++;
            const title = item.en?.title;
            
            if (!title) {
                console.log(`[${processed}/${items.length}] Item ${item.id}: No English title, skipping`);
                skipped++;
                continue;
            }
            
            // Get category name
            let categoryName = null;
            if (item.categories && item.categories.length > 0) {
                const categoryId = item.categories[0];
                const category = categoriesMap.get(categoryId);
                if (category && category.en && category.en.name) {
                    categoryName = category.en.name;
                }
            }
            
            // Get subcategory name
            let subcategoryName = null;
            if (item.subcategory && categoryName) {
                const category = categoriesMap.get(item.categories[0]);
                if (category && category.subcategories) {
                    const subcat = category.subcategories.find(sc => sc.id === item.subcategory);
                    if (subcat && subcat.en && subcat.en.name) {
                        subcategoryName = subcat.en.name;
                    }
                }
            }
            
            console.log(`[${processed}/${items.length}] Processing: ${title}`);
            if (categoryName) {
                console.log(`  Category: ${categoryName}${subcategoryName ? ` (${subcategoryName})` : ''}`);
            }
            
            // Fetch description
            let description = null;
            let retries = 0;
            const enableDebug = processed <= 3; // Debug first 3 items
            while (retries < MAX_RETRIES) {
                try {
                    description = await searchForItem(title, categoryName, subcategoryName, enableDebug);
                    if (description) {
                        console.log(`  ✓ Found description (${description.substring(0, 50)}...)`);
                        break; // Found description, exit loop
                    } else {
                        console.log(`  ✗ No description found`);
                        break; // No description found, exit loop (not an error)
                    }
                } catch (error) {
                    retries++;
                    if (retries < MAX_RETRIES) {
                        console.log(`  Retrying... (${retries}/${MAX_RETRIES})`);
                        await delay(DELAY_BETWEEN_REQUESTS);
                    } else {
                        console.log(`  ✗ Failed after ${MAX_RETRIES} retries: ${error.message}`);
                    }
                }
            }
            
            // Update English description if found
            if (description && item.en) {
                item.en.description = description;
                descriptionsFound++;
                updated++;
            }
            
            console.log(''); // Empty line for readability
            
            // Rate limiting
            await delay(DELAY_BETWEEN_REQUESTS);
        }
        
        // Save updated items
        await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
        
        console.log(`\n=== Summary ===`);
        console.log(`Total processed: ${processed}`);
        console.log(`Descriptions found: ${descriptionsFound}`);
        console.log(`Items updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`\nItems saved to: ${itemsJsonPath}`);
        
    } catch (error) {
        console.error('Error fetching item info:', error);
        process.exit(1);
    }
}

fetchItemInfo();

