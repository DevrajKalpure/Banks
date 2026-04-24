const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const ASSAM_JSON_PATH = "./politics/assembly-2026/by-state/assam.json";
const BASE_URL = "https://myneta.info/Assam2026/";
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function runDeepSync() {
    const targetDistrict = process.argv[2] ? process.argv[2].toLowerCase() : null;
    
    console.log("🚀 Starting Autonomous Sync for Assam...");
    if (targetDistrict) console.log(`🎯 Targeting District: ${targetDistrict.toUpperCase()}`);

    try {
        const localData = JSON.parse(fs.readFileSync(ASSAM_JSON_PATH, 'utf8'));
        let remoteList = [];

        // 1. Scan pages for candidate URLs
        for (let page = 1; page <= 8; page++) {
            process.stdout.write(`Scanning Page ${page}/8... `);
            const url = `${BASE_URL}index.php?action=summary&subAction=candidates_analyzed&sort=candidate&page=${page}#summary`;
            const response = await axios.get(url, { headers: HEADERS });
            const $ = cheerio.load(response.data);
            
            let count = 0;
            $('table.w3-table td a').each((i, el) => {
                const href = $(el).attr('href');
                const name = $(el).text().trim();
                if (href && href.includes('candidate.php?candidate_id=') && name.length > 3) {
                    remoteList.push({ name, url: BASE_URL + href });
                    count++;
                }
            });
            console.log(`(Found ${count})`);
        }

        console.log(`\nFound ${remoteList.length} total candidates. Starting Data Injection...\n`);

        let updatedCount = 0;
        for (let i = 0; i < remoteList.length; i++) {
            const remote = remoteList[i];
            const localIndex = localData.findIndex(c => 
                c.candidateName.toLowerCase().replace(/[^a-z]/g, '').includes(remote.name.toLowerCase().replace(/[^a-z]/g, '').split(' ')[0])
            );

            if (localIndex !== -1) {
                const local = localData[localIndex];
                if (targetDistrict && local.district.toLowerCase() !== targetDistrict) continue;

                try {
                    const detailRes = await axios.get(remote.url, { headers: HEADERS });
                    const $d = cheerio.load(detailRes.data);
                    const gridText = $d('.grid_23').text();
                    
                    if (gridText.includes("Self Profession:")) {
                        localData[localIndex].profession = gridText.split("Self Profession:")[1].split("\n")[0].trim();
                    }

                    const assetTable = $d('.grid_23 table.w3-table').first();
                    const totalAssetVal = assetTable.find('tr').first().find('td').eq(1).text().trim();
                    if (totalAssetVal) {
                        localData[localIndex].assets = totalAssetVal.replace(/[₹,Rs]/g, '').split('~')[0].trim();
                    }

                    const eduText = $d('b:contains("Educational Qualification:")').parent().next().text().trim();
                    if (eduText) localData[localIndex].education = eduText;

                    localData[localIndex].sourceType = "myneta-official";
                    updatedCount++;

                    if (updatedCount % 5 === 0) fs.writeFileSync(ASSAM_JSON_PATH, JSON.stringify(localData, null, 2));
                    process.stdout.write(`[${updatedCount}] Syncing ${remote.name}... ✅\n`);
                } catch (e) {}
            }
        }

        fs.writeFileSync(ASSAM_JSON_PATH, JSON.stringify(localData, null, 2));
        console.log(`\n🎉 MISSION COMPLETE! ${updatedCount} candidates fully enriched.`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

runDeepSync();
