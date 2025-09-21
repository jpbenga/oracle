const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');
const { apiFootballService } = require('./common/services/ApiFootball.service');

function determineResultsFromFixture(fixture) {
    const results = {};
    const ff = fixture.goals;
    const fh = fixture.score.halftime;
    if (ff.home === null || ff.away === null || fh.home === null || fh.away === null) return {};

    results['home_win'] = ff.home > ff.away ? 'WON' : 'LOST';
    results['away_win'] = ff.away > ff.home ? 'WON' : 'LOST';
    results['draw'] = ff.home === ff.away ? 'WON' : 'LOST';

    const sh = { home: ff.home - fh.home, away: ff.away - fh.away };
    results['btts'] = ff.home > 0 && ff.away > 0 ? 'WON' : 'LOST';
    results['btts_no'] = !(ff.home > 0 && ff.away > 0) ? 'WON' : 'LOST';

    [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].forEach(t => {
        results[`match_over_${t}`] = (ff.home + ff.away > t) ? 'WON' : 'LOST';
        results[`match_under_${t}`] = (ff.home + ff.away < t) ? 'WON' : 'LOST';
        results[`ht_over_${t}`] = (fh.home + fh.away > t) ? 'WON' : 'LOST';
        results[`ht_under_${t}`] = (fh.home + fh.away < t) ? 'WON' : 'LOST';
        results[`st_over_${t}`] = (sh.home + sh.away > t) ? 'WON' : 'LOST';
        results[`st_under_${t}`] = (sh.home + sh.away < t) ? 'WON' : 'LOST';
        results[`home_over_${t}`] = (ff.home > t) ? 'WON' : 'LOST';
        results[`home_under_${t}`] = (ff.home < t) ? 'WON' : 'LOST';
        results[`away_over_${t}`] = (ff.away > t) ? 'WON' : 'LOST';
        results[`away_under_${t}`] = (ff.away < t) ? 'WON' : 'LOST';
        results[`home_ht_over_${t}`] = (fh.home > t) ? 'WON' : 'LOST';
        results[`home_ht_under_${t}`] = (fh.home < t) ? 'WON' : 'LOST';
        results[`away_ht_over_${t}`] = (fh.away > t) ? 'WON' : 'LOST';
        results[`away_ht_under_${t}`] = (fh.away < t) ? 'WON' : 'LOST';
        results[`home_st_over_${t}`] = (sh.home > t) ? 'WON' : 'LOST';
        results[`home_st_under_${t}`] = (sh.home < t) ? 'WON' : 'LOST';
        results[`away_st_over_${t}`] = (sh.away > t) ? 'WON' : 'LOST';
        results[`away_st_under_${t}`] = (sh.away < t) ? 'WON' : 'LOST';
    });
    return results;
}

function getMatchStatus(shortStatus) {
    switch(shortStatus) {
        case 'TBD':
        case 'NS':
            return 'Not Started';
        case '1H':
        case 'HT':
        case '2H':
        case 'ET':
        case 'BT':
        case 'P':
        case 'LIVE':
            return 'Running';
        case 'FT':
        case 'AET':
        case 'PEN':
            return 'Completed';
        case 'SUSP':
        case 'INT':
        case 'PST':
        case 'CANC':
        case 'ABD':
        case 'AWD':
        case 'WO':
            return 'Interrupted';
        default:
            return 'Unknown';
    }
}

async function generateHtmlReport(predictions, globalStatus) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        h1, h2 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; }
        .status { background-color: #1e1e1e; border: 1px solid #373737; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 1.1em; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #373737; }
        th { background-color: #2a2a2a; }
        .team-logo { width: 20px; height: 20px; margin-right: 8px; vertical-align: middle; }
        .result-WON { color: #03dac6; font-weight: bold; }
        .result-LOST { color: #cf6679; font-weight: bold; }
        .status-Not.Started { color: #f0e68c; }
        .status-Running { color: #ffab40; }
        .status-Completed { color: #03dac6; }
    `;
    let body = `<h1>Rapport de Vérification des Résultats</h1><div class="status"><strong>Statut du cycle:</strong> ${globalStatus}</div>`;

    if (predictions.length === 0) {
        body += `<p>Aucune prédiction à vérifier pour ce cycle.</p>`;
    } else {
        body += `<table>
                    <thead>
                        <tr>
                            <th>Match</th>
                            <th>Pari</th>
                            <th>Score Final</th>
                            <th>Score Mi-temps</th>
                            <th>Statut Match</th>
                            <th>Résultat Pari</th>
                        </tr>
                    </thead>
                    <tbody>`;
        predictions.forEach(p => {
            const finalScore = p.finalScore ? `${p.finalScore.home} - ${p.finalScore.away}` : '-';
            const halftimeScore = p.halftimeScore ? `${p.halftimeScore.home} - ${p.halftimeScore.away}` : '-';
            body += `
                <tr>
                    <td>
                        <img src="${p.home_team.logo}" class="team-logo"> ${p.home_team.name} vs 
                        <img src="${p.away_team.logo}" class="team-logo"> ${p.away_team.name}
                    </td>
                    <td>${p.market}</td>
                    <td>${finalScore}</td>
                    <td>${halftimeScore}</td>
                    <td class="status-${p.match_status.replace(' ', '.')}">${p.match_status}</td>
                    <td class="result-${p.result}">${p.result || 'PENDING'}</td>
                </tr>
            `;
        });
        body += `</tbody></table>`;
    }

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport de Vérification</title><style>${css}</style></head><body>${body}</body></html>`;
}

functions.http('resultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Résultats ---"));

    const pendingPredictions = await firestoreService.getPendingPredictions();
    
    if (pendingPredictions.length === 0) {
        const message = "Aucune prédiction en attente à vérifier.";
        console.log(chalk.yellow(message));
        const html = await generateHtmlReport([], message);
        res.status(200).send(html);
        return;
    }

    console.log(chalk.white.bold(`   -> ${pendingPredictions.length} prédiction(s) en attente trouvée(s).`));
    
    const fixtureIdsToQuery = [...new Set(pendingPredictions.map(p => p.fixtureId))];
    console.log(chalk.cyan(`   -> Récupération des données pour ${fixtureIdsToQuery.length} match(s) unique(s)...`));
    
    const fixturesData = [];
    for (const id of fixtureIdsToQuery) {
        const fixture = await apiFootballService.getMatchById(id);
        if (fixture) fixturesData.push(fixture);
    }

    const updatedPredictions = [];
    let wonCount = 0;
    let lostCount = 0;

    for (const prediction of pendingPredictions) {
        const fixture = fixturesData.find(f => f.fixture.id === prediction.fixtureId);
        if (fixture) {
            const newStatus = getMatchStatus(fixture.fixture.status.short);
            prediction.match_status = newStatus;
            
            if (newStatus === 'Completed') {
                const allMarketResults = determineResultsFromFixture(fixture);
                const result = allMarketResults[prediction.market] || 'UNKNOWN';
                prediction.result = result;
                prediction.finalScore = fixture.goals;
                prediction.halftimeScore = fixture.score.halftime;

                if (result === 'WON') {
                    wonCount++;
                } else if (result === 'LOST') {
                    lostCount++;
                }
            }
            
            await firestoreService.updatePredictionStatus(prediction.id, {
                match_status: prediction.match_status,
                result: prediction.result || null,
                finalScore: prediction.finalScore || null,
                halftimeScore: prediction.halftimeScore || null,
            });
            updatedPredictions.push(prediction);
        }
    }

    const totalProcessed = wonCount + lostCount;
    const successRate = totalProcessed > 0 ? ((wonCount / totalProcessed) * 100).toFixed(2) : 0;
    
    let finalMessage = `${updatedPredictions.length} prédictions mises à jour.`;
    if (totalProcessed > 0) {
        finalMessage += ` Résultats des paris terminés: ${wonCount} gagnés, ${lostCount} perdus (Taux de réussite: ${successRate}%).`;
    }

    console.log(chalk.blue.bold(`\n--- ${finalMessage} Job Terminé ---`));
    const finalHtml = await generateHtmlReport(pendingPredictions, finalMessage);
    res.status(200).send(finalHtml);
});