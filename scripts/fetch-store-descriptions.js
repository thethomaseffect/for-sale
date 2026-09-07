const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');
const unfluff = require('unfluff');

const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');
const categoriesJsonPath = path.join(__dirname, '..', 'public', 'data', 'categories.json');

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds to be respectful

// Helper function to make HTTP requests
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        };
        
        const req = protocol.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Simplify title for better Wikipedia matching
function simplifyTitle(title) {
    // Remove common volume/edition indicators
    let simplified = title
        .replace(/\s+Volumes?\s+\d+(\s+and\s+\d+)?/gi, '')
        .replace(/\s+Volume\s+\d+/gi, '')
        .replace(/\s+Vol\.\s+\d+/gi, '')
        .replace(/\s+\([^)]*\)/g, '') // Remove parenthetical info like "(Discworld)"
        .trim();
    
    return simplified;
}

// Search Wikipedia for a title
async function searchWikipedia(title, mediaType = '', debug = false) {
    try {
        // Try multiple search strategies
        const searchQueries = [
            title, // Original title
            simplifyTitle(title), // Simplified title
        ];
        
        // If title contains parenthetical info, try without it
        const parenMatch = title.match(/^([^(]+)\(/);
        if (parenMatch) {
            searchQueries.push(parenMatch[1].trim());
        }
        
        // If we have a media type, add it to simplified queries
        if (mediaType) {
            searchQueries.push(`${simplifyTitle(title)} ${mediaType}`);
        }
        
        for (const searchQuery of searchQueries) {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchQuery)}&limit=5&format=json`;
            
            if (debug) {
                console.log(`    DEBUG: Searching Wikipedia: ${searchQuery}`);
            }
            
            const response = await makeRequest(searchUrl);
            const data = JSON.parse(response);
            
            // data[0] = search term, data[1] = titles, data[2] = descriptions, data[3] = URLs
            if (data[1] && data[1].length > 0) {
                // Get the first result
                const wikiTitle = data[1][0];
                const wikiUrl = data[3][0];
                
                if (debug) {
                    console.log(`    DEBUG: Found Wikipedia page: ${wikiTitle}`);
                    console.log(`    DEBUG: URL: ${wikiUrl}`);
                }
                
                return { title: wikiTitle, url: wikiUrl };
            }
        }
        
        if (debug) {
            console.log(`    DEBUG: No Wikipedia results found after trying ${searchQueries.length} queries`);
        }
        
        return null;
    } catch (error) {
        if (debug) {
            console.log(`    DEBUG: Error searching Wikipedia: ${error.message}`);
        }
        return null;
    }
}

// Get media title from Wikipedia page title
function getMediaTitle(fullLinkText) {
    let title = fullLinkText.split(' - Wikipedia')[0];
    title = title.split(' (Wikipedia)')[0];
    
    // Handle "List of X episodes" for TV shows
    const listOfEpsRegex = /.*List of (.*) episodes/.exec(title);
    if (listOfEpsRegex) {
        return listOfEpsRegex[1];
    }
    
    // Handle "(film)" suffix
    const filmRegex = /(.*) \(film\)/.exec(title);
    if (filmRegex) {
        return filmRegex[1];
    }
    
    return title;
}

// Get relevant content text from extracted text
function getContentText(text, mediaTypes) {
    if (!text) return '';
    
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) return '';
    
    // If media types provided, build regex to find relevant paragraphs
    if (mediaTypes && mediaTypes.length > 0) {
        const re = new RegExp('\\b' + mediaTypes.join('\\b|\\b') + '\\b', 'i');
        
        // Check if media type is in first paragraph
        if (re.test(paragraphs[0])) {
            return paragraphs[0];
        }
        
        // Check first 4 paragraphs
        for (let i = 1; i < Math.min(4, paragraphs.length); i++) {
            if (re.test(paragraphs[i])) {
                return paragraphs.slice(0, i + 1).join('\n');
            }
        }
    }
    
    // Return first paragraph if no media type match or no media types provided
    return paragraphs[0];
}

// Remove unwanted characters from text
function removeUnwantedChars(text, title) {
    if (!text) return '';
    
    // Remove Asian pronunciations: Title(pronunciation) 
    const asianPronunciationsRegex = new RegExp(title + '\\([\\s\\S]*?\\) ', 'i');
    let cleaned = text.replace(asianPronunciationsRegex, title);
    
    // Remove Wikipedia citation links [1], [2], etc.
    cleaned = cleaned.replace(/(\[.*?\])/ig, '');
    
    // Remove "From Wikipedia, the free encyclopedia" and similar
    cleaned = cleaned.replace(/From Wikipedia.*?encyclopedia/gi, '');
    cleaned = cleaned.replace(/This article.*?encyclopedia/gi, '');
    
    return cleaned.trim();
}

// Fetch description from Wikipedia
async function fetchWikipediaDescription(itemTitle, categoryName = '', debug = false) {
    try {
        // Search Wikipedia
        const wikiResult = await searchWikipedia(itemTitle, categoryName, debug);
        
        if (!wikiResult) {
            return null;
        }
        
        // Fetch the Wikipedia page using API to get plain text
        if (debug) {
            console.log(`    DEBUG: Fetching Wikipedia page content...`);
        }
        
        await delay(DELAY_BETWEEN_REQUESTS);
        
        // Extract page title from URL
        const pageTitle = wikiResult.url.split('/wiki/')[1];
        const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json`;
        
        if (debug) {
            console.log(`    DEBUG: API URL: ${apiUrl}`);
        }
        
        const apiResponse = await makeRequest(apiUrl);
        const apiData = JSON.parse(apiResponse);
        
        // Extract text from API response
        let extractedText = '';
        const pages = apiData.query?.pages;
        if (pages) {
            const pageId = Object.keys(pages)[0];
            const pageData = pages[pageId];
            extractedText = pageData.extract || '';
        }
        
        // If API doesn't work, try HTML scraping with unfluff as fallback
        if (!extractedText || extractedText.trim().length === 0) {
            if (debug) {
                console.log(`    DEBUG: API returned no text, trying HTML scraping...`);
            }
            
            const html = await makeRequest(wikiResult.url);
            let data;
            try {
                data = unfluff(html);
                if (data && data.text) {
                    extractedText = data.text;
                } else if (data && data.description) {
                    extractedText = data.description;
                }
            } catch (error) {
                if (debug) {
                    console.log(`    DEBUG: Error parsing with unfluff: ${error.message}`);
                }
            }
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
            if (debug) {
                console.log(`    DEBUG: Could not extract text from Wikipedia page`);
            }
            return null;
        }
        
        if (debug) {
            console.log(`    DEBUG: Extracted text length: ${extractedText.length}`);
        }
        
        // Get relevant content
        const mediaType = categoryName ? [categoryName.toLowerCase()] : [];
        const relevantParagraphs = getContentText(extractedText, mediaType);
        
        if (!relevantParagraphs || relevantParagraphs.length < 50) {
            if (debug) {
                console.log(`    DEBUG: Extracted text too short (${relevantParagraphs ? relevantParagraphs.length : 0} chars)`);
            }
            return null;
        }
        
        // Clean up the text
        const cleanedTitle = getMediaTitle(wikiResult.title);
        const description = removeUnwantedChars(relevantParagraphs, cleanedTitle);
        
        if (description.length < 50) {
            if (debug) {
                console.log(`    DEBUG: Cleaned description too short (${description.length} chars)`);
            }
            return null;
        }
        
        if (debug) {
            console.log(`    DEBUG: Extracted description (${description.length} chars)`);
            console.log(`    DEBUG: Preview: ${description.substring(0, 150)}...`);
        }
        
        return description;
    } catch (error) {
        if (debug) {
            console.log(`    DEBUG: Error fetching Wikipedia description: ${error.message}`);
        }
        return null;
    }
}

// Delay helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchStoreDescriptions() {
    try {
        const itemsData = await fs.readJson(itemsJsonPath);
        const categoriesData = await fs.readJson(categoriesJsonPath);
        
        // Create a map of category IDs to names
        const categoryMap = {};
        categoriesData.categories.forEach(cat => {
            categoryMap[cat.id] = cat.en.name;
        });
        
        const allItems = itemsData.items.filter(item => item.active !== false);
        const items = allItems; // Process all active items
        
        console.log(`Found ${allItems.length} active items, processing all ${items.length}\n`);
        console.log('Searching Wikipedia and extracting descriptions...\n');
        
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
            
            // Get category name for better search
            const categoryId = item.categories && item.categories.length > 0 ? item.categories[0] : null;
            const categoryName = categoryId ? categoryMap[categoryId] : '';
            
            console.log(`[${processed}/${items.length}] Processing: ${title}`);
            if (categoryName) {
                console.log(`  Category: ${categoryName}`);
            }
            
            try {
                const enableDebug = processed <= 5; // Debug first 5 items
                const description = await fetchWikipediaDescription(title, categoryName, enableDebug);
                
                if (description) {
                    console.log(`  ✓ Found description (${description.length} chars)`);
                    if (item.en) {
                        item.en.description = description;
                        descriptionsFound++;
                        updated++;
                    }
                } else {
                    console.log(`  ✗ Could not find description on Wikipedia`);
                }
            } catch (error) {
                console.log(`  ✗ Error: ${error.message}`);
            }
            
            console.log(''); // Empty line
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
        console.error('Error fetching descriptions:', error);
        process.exit(1);
    }
}

fetchStoreDescriptions();
