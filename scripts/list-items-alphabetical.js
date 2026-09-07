const fs = require('fs-extra');
const path = require('path');

const itemsJsonPath = path.join(__dirname, '..', 'public', 'data', 'items.json');

async function listItemsAlphabetical() {
    try {
        const data = await fs.readJson(itemsJsonPath);
        const items = data.items
            .filter(item => item.active !== false)
            .sort((a, b) => {
                const titleA = (a.en?.title || '').toLowerCase();
                const titleB = (b.en?.title || '').toLowerCase();
                return titleA.localeCompare(titleB);
            });
        
        console.log(`\nAll ${items.length} active items in alphabetical order:\n`);
        
        items.forEach((item, index) => {
            const title = item.en?.title || 'No title';
            const hasDescription = item.en?.description && item.en.description.length > 50;
            const descStatus = hasDescription ? '✓' : '✗';
            console.log(`${String(index + 1).padStart(3)}. ${descStatus} ${title} (ID: ${item.id})`);
        });
        
        const withDescriptions = items.filter(item => item.en?.description && item.en.description.length > 50).length;
        console.log(`\nSummary: ${withDescriptions} items with descriptions, ${items.length - withDescriptions} without`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listItemsAlphabetical();



