const fs = require('fs-extra');
const path = require('path');

// Translation mapping for common qualityNotes
const translations = {
  "": { en: "", sv: "" },
  "Some damage to plastic covering on Mostly Void, Partially Stars": {
    en: "Some damage to plastic covering on Mostly Void, Partially Stars",
    sv: "Någon skada på plastomslaget på Mostly Void, Partially Stars"
  },
  "Some light damage to backside of cover": {
    en: "Some light damage to backside of cover",
    sv: "Någon lätt skada på baksidan av omslaget"
  },
  "Some light damage to plastic covering": {
    en: "Some light damage to plastic covering",
    sv: "Någon lätt skada på plastomslaget"
  },
  "Some light damage to covers": {
    en: "Some light damage to covers",
    sv: "Någon lätt skada på omslagen"
  },
  "Some light damage to cover": {
    en: "Some light damage to cover",
    sv: "Någon lätt skada på omslaget"
  },
  "Seller ordered a second copy by mistake": {
    en: "Seller ordered a second copy by mistake",
    sv: "Säljaren beställde en andra kopia av misstag"
  },
  "One minor bump on side of back cover": {
    en: "One minor bump on side of back cover",
    sv: "En mindre bula på sidan av bakomslaget"
  },
  "Some wear and tear on cover from being read": {
    en: "Some wear and tear on cover from being read",
    sv: "Något slitage på omslaget från att ha lästs"
  },
  "Some wear from use, but functioning perfectly with the superior OLED screen": {
    en: "Some wear from use, but functioning perfectly with the superior OLED screen",
    sv: "Något slitage från användning, men fungerar perfekt med den överlägsna OLED-skärmen"
  },
  "Never played": {
    en: "Never played",
    sv: "Aldrig spelat"
  },
  "Never played, but some wear to cover": {
    en: "Never played, but some wear to cover",
    sv: "Aldrig spelat, men något slitage på omslaget"
  },
  "Some damage to box": {
    en: "Some damage to box",
    sv: "Någon skada på lådan"
  },
  "Light dent on box. Never played": {
    en: "Light dent on box. Never played",
    sv: "Lätt buckla på lådan. Aldrig spelat"
  },
  "Well-used, though in good condition": {
    en: "Well-used, though in good condition",
    sv: "Väl använd, men i gott skick"
  },
  "Never player, though some cleaning of game box required": {
    en: "Never played, though some cleaning of game box required",
    sv: "Aldrig spelat, men lite rengöring av spellädan krävs"
  },
  "Played once": {
    en: "Played once",
    sv: "Spelat en gång"
  },
  "Played twice": {
    en: "Played twice",
    sv: "Spelat två gånger"
  },
  "Box slightly damaged, but game is perfect, only played 3 times": {
    en: "Box slightly damaged, but game is perfect, only played 3 times",
    sv: "Lådan lite skadad, men spelet är perfekt, bara spelat 3 gånger"
  },
  "A little dusty, but in good condition": {
    en: "A little dusty, but in good condition",
    sv: "Lite dammig, men i gott skick"
  },
  "Box was opened, rulebook read, then put back, otherwise same as retail": {
    en: "Box was opened, rulebook read, then put back, otherwise same as retail",
    sv: "Lådan öppnades, regelboken lästes, sedan lades tillbaka, annars samma som i butik"
  },
  "Played a few times, everything is in good condition": {
    en: "Played a few times, everything is in good condition",
    sv: "Spelat några gånger, allt är i gott skick"
  },
  "Barely used, played about 3 times": {
    en: "Barely used, played about 3 times",
    sv: "Knappt använd, spelat cirka 3 gånger"
  },
  "Some light wear from use": {
    en: "Some light wear from use",
    sv: "Något lätt slitage från användning"
  },
  "Some damage to cover": {
    en: "Some damage to cover",
    sv: "Någon skada på omslaget"
  }
};

async function convertQualityNotesToTranslations() {
  try {
    // Get the project root (parent of scripts directory)
    const projectRoot = path.resolve(__dirname, '..');
    const itemsJsonPath = path.join(projectRoot, 'public/data/items.json');
    const itemsData = await fs.readJson(itemsJsonPath);
    
    let updated = 0;
    let missingTranslations = new Set();
    
    for (const item of itemsData.items) {
      // Always process qualityNotes - convert strings to objects
      let qualityNotesStr = "";
      let isAlreadyObject = false;
      
      if (item.qualityNotes !== undefined && item.qualityNotes !== null) {
        // If it's already an object with en/sv, check if it has the right structure
        if (typeof item.qualityNotes === 'object' && !Array.isArray(item.qualityNotes)) {
          // Check if it has en and sv properties
          if (item.qualityNotes.en !== undefined && item.qualityNotes.sv !== undefined) {
            isAlreadyObject = true;
          } else {
            // If it's an object but doesn't have en/sv, treat as string
            qualityNotesStr = item.qualityNotes.en || item.qualityNotes.sv || String(item.qualityNotes);
          }
        } else {
          // Convert string to translation object
          qualityNotesStr = item.qualityNotes === "" ? "" : String(item.qualityNotes);
        }
      } else {
        // If undefined or null, set to empty translation object
        qualityNotesStr = "";
      }
      
      // Skip if already properly formatted
      if (isAlreadyObject) {
        continue;
      }
      
      // Convert to translation object
      if (translations[qualityNotesStr]) {
        item.qualityNotes = translations[qualityNotesStr];
        updated++;
      } else {
        // If translation not found, create a basic one (English only, Swedish same for now)
        // This shouldn't happen, but handle it gracefully
        if (qualityNotesStr !== "") {
          missingTranslations.add(qualityNotesStr);
          // Create a basic translation object
          item.qualityNotes = {
            en: qualityNotesStr,
            sv: qualityNotesStr // Fallback to English until translated
          };
          updated++;
        } else {
          item.qualityNotes = { en: "", sv: "" };
          updated++;
        }
      }
    }
    
    // Write back to file
    await fs.writeJson(itemsJsonPath, itemsData, { spaces: 2 });
    
    console.log(`Updated ${updated} items to use translated qualityNotes`);
    console.log(`Total items: ${itemsData.items.length}`);
    
    if (missingTranslations.size > 0) {
      console.log('\n⚠️  Missing translations for:');
      missingTranslations.forEach(note => console.log(`  - "${note}"`));
    }
    
  } catch (error) {
    console.error('Error updating items:', error);
    process.exit(1);
  }
}

convertQualityNotesToTranslations();

