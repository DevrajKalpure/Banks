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
            
            // Map the flat entries to a results array
            const results = [
                { name: constEntry.winner, rank: 1, votes: constEntry.winnerVotes },
                { name: constEntry.runnerUp1, rank: 2, votes: constEntry.runnerUp1Votes },
                { name: constEntry.runnerUp2, rank: 3, votes: constEntry.runnerUp2Votes }
            ].filter(r => r.name); // Remove if runnerUp2 is missing

            results.forEach(result => {
                const normalizedRemoteName = normalizeName(result.name);
                
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
                    localData[localIndex].lastUpdated = "2026-05-05";
                    updatedCount++;
                }
            });
        });

        // For all other candidates in the file, if they aren't in the top 3, mark as participating or lost?
        // Actually, better to mark them as "lost" if they didn't make the top 3 but are in the file.
        localData.forEach(c => {
            if (c.result === "participating") {
                c.result = "lost";
            }
        });

        fs.writeFileSync(KERALA_JSON_PATH, JSON.stringify(localData, null, 2));
        console.log(`\n🎉 MERGE COMPLETE! ${updatedCount} candidate results injected into kerala.json`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

runMerge();
