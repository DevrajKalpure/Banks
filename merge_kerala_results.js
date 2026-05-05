const fs = require('fs');

const KERALA_JSON_PATH = "./politics/assembly-2026/by-state/kerala.json";
const SCRAPED_JSON_PATH = "./politics/assembly-2026/by-state/kerala_results_scraped.json";

function normalizeName(name) {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/adv\.|advocate|dr\.|smt\.|shri/g, '')
        .replace(/[^a-z]/g, '')
        .trim();
}

function runMerge() {
    console.log("🚀 Starting Merge for Kerala Results...");
    
    try {
        const localData = JSON.parse(fs.readFileSync(KERALA_JSON_PATH, 'utf8'));
        const scrapedData = JSON.parse(fs.readFileSync(SCRAPED_JSON_PATH, 'utf8'));

        let updatedCount = 0;

        scrapedData.forEach(constEntry => {
            const constituencyName = constEntry.constituency.toLowerCase().trim();
            const results = constEntry.results;

            results.forEach(result => {
                const normalizedRemoteName = normalizeName(result.candidateName);
                
                // Find matching candidate in local data for this constituency
                const localIndex = localData.findIndex(c => 
                    c.constituencyName.toLowerCase().trim() === constituencyName &&
                    (normalizeName(c.candidateName).includes(normalizedRemoteName) || 
                     normalizedRemoteName.includes(normalizeName(c.candidateName)))
                );

                if (localIndex !== -1) {
                    localData[localIndex].votes = result.votes;
                    localData[localIndex].rank = result.rank;
                    localData[localIndex].isWinner = result.rank === 1;
                    localData[localIndex].result = result.rank === 1 ? "won" : "lost";
                    updatedCount++;
                } else {
                    // If candidate doesn't exist, we could add them, but for now we just log
                    // console.log(`⚠️ Match not found for ${result.candidateName} in ${constituencyName}`);
                }
            });
        });

        fs.writeFileSync(KERALA_JSON_PATH, JSON.stringify(localData, null, 2));
        console.log(`\n🎉 MERGE COMPLETE! ${updatedCount} candidate results injected into kerala.json`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

runMerge();
