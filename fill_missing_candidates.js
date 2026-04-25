const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const ASSAM_JSON_PATH = "./politics/assembly-2026/by-state/assam.json";
const BASE_URL = "https://myneta.info/Assam2026/";
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function fetchMissingCandidates() {
    console.log("🚀 Starting Autonomous Fetch for Top 2 Candidates per Constituency...");
    
    let localData = [];
    try {
        localData = JSON.parse(fs.readFileSync(ASSAM_JSON_PATH, 'utf8'));
    } catch (e) {
        console.error("Could not read local JSON. Ensure you run this in 'processed' folder.");
        return;
    }

    const byConst = {};
    localData.forEach(c => {
        const cName = c.constituencyName.toLowerCase().trim();
        if (!byConst[cName]) byConst[cName] = { bjp: null, opp: null };
        
        if (c.partyName && c.partyName.toLowerCase().includes('bharatiya janata party')) {
            byConst[cName].bjp = c;
        } else if (c.partyName && !c.partyName.toLowerCase().includes('independent')) {
            byConst[cName].opp = c;
        }
    });

    let newCandidatesAdded = 0;

    for (let page = 1; page <= 10; page++) {
        process.stdout.write(`Scanning MyNeta Page ${page}... `);
        try {
            const url = `${BASE_URL}index.php?action=summary&subAction=candidates_analyzed&sort=candidate&page=${page}#summary`;
            const response = await axios.get(url, { headers: HEADERS });
            const $ = cheerio.load(response.data);
            
            let foundOnPage = 0;
            // Extract obfuscated script contents
            let decodedHtml = '';
            const mockEnv = {
                document: {
                    write: function(str) {
                        decodedHtml += str;
                    }
                },
                window: {}
            };
            const vm = require('vm');
            
            $('script').each((i, el) => {
                const scriptContent = $(el).html();
                if (scriptContent && scriptContent.includes('eval(function(')) {
                    try {
                        const context = vm.createContext({
                            document: mockEnv.document,
                            window: mockEnv.window,
                        });
                        vm.runInContext(scriptContent, context);
                    } catch (e) {
                        // Ignore eval errors
                    }
                }
            });

            // Parse the decoded HTML which contains the table rows
            const $decoded = cheerio.load(`<table>${decodedHtml}</table>`);
            const rows = $decoded('tr');
            
            for (let i = 0; i < rows.length; i++) {
                const row = $(rows[i]);
                const link = row.find('a[href*="candidate.php?candidate_id="]');
                
                if (link.length > 0) {
                    const cols = row.find('td');
                    if (cols.length >= 6) {
                        const name = link.text().trim();
                        const profileUrl = BASE_URL + link.attr('href');
                        const constituency = $(cols[1]).text().trim().replace(/Rowspan=2\|\s*/g, '');
                        const party = $(cols[2]).text().trim();
                        const education = $(cols[4]).text().trim();
                        const assets = $(cols[5]).text().trim().replace(/[₹,Rs~A-Za-z\s]/g, '');
                        
                        const cNameLower = constituency.toLowerCase().trim();
                        if (!byConst[cNameLower]) byConst[cNameLower] = { bjp: null, opp: null };
                        
                        let isBJP = party.toLowerCase().includes('bharatiya janata party');
                        
                        let needsAdding = false;
                        if (isBJP && !byConst[cNameLower].bjp) {
                            needsAdding = true;
                        } else if (!isBJP && party.toLowerCase() !== 'ind' && !byConst[cNameLower].opp) {
                            needsAdding = true;
                        }

                        if (needsAdding) {
                            const exists = localData.some(c => c.candidateName.toLowerCase() === name.toLowerCase());
                            if (!exists) {
                                console.log(`\nFound missing for ${constituency}: ${name} (${party})`);
                                
                                let profession = "";
                                try {
                                    const detailRes = await axios.get(profileUrl, { headers: HEADERS });
                                    const $d = cheerio.load(detailRes.data);
                                    const gridText = $d('.grid_23').text();
                                    if (gridText.includes("Self Profession:")) {
                                        profession = gridText.split("Self Profession:")[1].split("\n")[0].trim();
                                    }
                                } catch(e) {}

                                const newCandidate = {
                                    office: "mla",
                                    electionYear: 2026,
                                    state: "Assam",
                                    stateSlug: "assam",
                                    district: "", 
                                    constituencyName: constituency,
                                    constituencySlug: constituency.toLowerCase().replace(/\s+/g, '-'),
                                    candidateName: name,
                                    candidateSlug: name.toLowerCase().replace(/\s+/g, '-'),
                                    partyName: party,
                                    education: education,
                                    profession: profession,
                                    assets: assets,
                                    sourceType: "myneta-official"
                                };

                                localData.push(newCandidate);
                                if (isBJP) byConst[cNameLower].bjp = newCandidate;
                                else byConst[cNameLower].opp = newCandidate;
                                
                                newCandidatesAdded++;
                                foundOnPage++;
                            }
                        }
                    }
                }
            }
            console.log(`(Added ${foundOnPage} candidates)`);
        } catch (e) {
            console.log(`Failed to fetch page ${page}`);
        }
    }

    if (newCandidatesAdded > 0) {
        fs.writeFileSync(ASSAM_JSON_PATH, JSON.stringify(localData, null, 2));
        console.log(`\n🎉 SUCCESS: Added ${newCandidatesAdded} new candidates. Saved to ${ASSAM_JSON_PATH}`);
    } else {
        console.log(`\n✅ Database is already complete! Found Top 2 candidates for all constituencies.`);
    }
}

fetchMissingCandidates();
