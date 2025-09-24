// Force git to detect changes
const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('../common/services/Firestore.service');
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

async function generateHtmlReport(executionId, results) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        h1, h2, h3 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; }
        .report-container { background-color: #1e1e1e; border: 1px solid #373737; border-radius: 8px; margin-bottom: 30px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #373737; }
        th { background-color: #2a2a2a; }
        .status-WON { color: #03dac6; font-weight: bold; }
        .status-LOST { color: #cf6679; font-weight: bold; }
        .status-UNKNOWN { color: #888; }
        .summary { display: flex; flex-wrap: wrap; gap: 20px; font-size: 1.1em; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #373737; }
    `;
    let body = `<h1>Rapport de Vérification des Résultats</h1>`;

    if (results.length === 0) {
        body += `<p>Aucun résultat à afficher pour l\'exécution : ${executionId}.</p>`;
        return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport de Vérification</title><style>${css}</style></head><body>${body}</body></html>`;
    }

    const wonCount = results.filter(r => r.result === 'WON').length;
    const lostCount = results.filter(r => r.result === 'LOST').length;
    const pendingCount = results.filter(r => r.result !== 'WON' && r.result !== 'LOST').length;
    const totalProcessed = wonCount + lostCount;
    const successRate = totalProcessed > 0 ? ((wonCount / totalProcessed) * 100).toFixed(2) : 0;

    const allPredictions = await firestoreService.getPredictionsFromDateRange(new Date(new Date().setDate(new Date().getDate() - 2)), new Date());
    const predictionDateMap = new Map(allPredictions.map(p => [p.id, p.matchDate]));

    body += `
        <div class="report-container">
            <h2>Rapport pour l'exécution du jour</h2>
            <div class="summary">
                <span>Total traité: ${results.length}</span>
                <span class="status-WON">Gagnés: ${wonCount}</span>
                <span class="status-LOST">Perdus: ${lostCount}</span>
                <span>En attente: ${pendingCount}</span>
                <span><b>Taux de réussite (sur terminés): ${successRate}%</b></span>
            </div>`;

    const resultsByLeague = results.reduce((acc, res) => {
        const league = res.leagueName || 'Inconnue';
        if (!acc[league]) acc[league] = [];
        acc[league].push(res);
        return acc;
    }, {});

    let globalCounter = 1;
    for (const league in resultsByLeague) {
        body += `<h3>${league}</h3>
                 <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Match</th>
                            <th>Marché</th>
                            <th>Confiance</th>
                            <th>Score Final</th>
                            <th>Résultat</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        const sortedResults = resultsByLeague[league].sort((a, b) => {
            const dateA = a.matchDate || predictionDateMap.get(a.predictionId);
            const dateB = b.matchDate || predictionDateMap.get(b.predictionId);
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            if (a.matchLabel < b.matchLabel) return -1;
            if (a.matchLabel > b.matchLabel) return 1;
            return 0;
        });

        sortedResults.forEach(res => {
            const matchDateValue = res.matchDate || predictionDateMap.get(res.predictionId);
            const matchDate = matchDateValue ? new Date(matchDateValue).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A';
            body += `
                <tr>
                    <td>${globalCounter++}</td>
                    <td>${matchDate}</td>
                    <td>${res.matchLabel}</td>
                    <td>${res.market}</td>
                    <td>${res.score ? res.score.toFixed(2) + '%' : 'N/A'}</td>
                    <td>${res.finalScore ? `${res.finalScore.home} - ${res.finalScore.away}` : '-'}</td>
                    <td class="status-${res.result}">${res.result}</td>
                </tr>
            `;
        });
        body += `</tbody></table>`;
    }
    body += `</div>`;

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport de Vérification</title><style>${css}</style></head><body>${body}</body></html>`;
}


functions.http('resultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Résultats ---"));

    // Get predictions from the last 48 hours
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const allRecentPredictions = await firestoreService.getPredictionsFromDateRange(yesterday, today);
    if (!allRecentPredictions || allRecentPredictions.length === 0) {
        console.log(chalk.yellow("Aucune prédiction récente à vérifier."));
        const html = await generateHtmlReport('Aucune prédiction récente', []);
        res.status(200).send(html);
        return;
    }
    
    console.log(chalk.white.bold(`   -> ${allRecentPredictions.length} prédiction(s) récente(s) trouvée(s).`));

    // This is a placeholder for a proper reporting mechanism if needed in the future
    const executionId = `results-check-${today.toISOString().split('T')[0]}`;

    const existingResults = await firestoreService.getReportResults(executionId); // This might need adjustment
    const processedPredictionIds = new Set(existingResults.map(r => r.predictionId));

    const predictionsToProcess = allRecentPredictions.filter(p => !processedPredictionIds.has(p.id));
    
    if (predictionsToProcess.length === 0) {
        console.log(chalk.gray(`Toutes les prédictions récentes ont déjà un résultat.`));
        const html = await generateHtmlReport(executionId, existingResults);
        res.status(200).send(html);
        return;
    }

    const fixtureIdsToQuery = [...new Set(predictionsToProcess.map(p => p.fixtureId))];
    console.log(chalk.cyan(`   -> Récupération des résultats pour ${fixtureIdsToQuery.length} match(s) unique(s)...`));
    
    const fixturesData = await apiFootballService.getFixturesByIds(fixtureIdsToQuery);

    const fixtureResultsMap = {};
    fixturesData.forEach(fixture => {
        if (fixture.fixture.status.short === 'FT') {
            fixtureResultsMap[fixture.fixture.id] = determineResultsFromFixture(fixture);
        }
    });

    const newResultsToSave = [];
    let wonCount = 0;
    let lostCount = 0;
    for (const prediction of predictionsToProcess) {
        const allMarketResults = fixtureResultsMap[prediction.fixtureId];
        if (allMarketResults) {
            const result = allMarketResults[prediction.market] || 'UNKNOWN';
            const fixture = fixturesData.find(f => f.fixture.id === prediction.fixtureId);

            const dataToSave = {
                predictionId: prediction.id,
                market: prediction.market,
                score: prediction.score,
                odd: prediction.odd,
                matchDate: prediction.matchDate,
                matchLabel: `${prediction.home_team.name} vs ${prediction.away_team.name}`,
                leagueName: prediction.league.name, // Correction du chemin
                finalScore: { home: fixture.goals.home, away: fixture.goals.away },
                result: result
            };

            // Log détaillé de l'objet avant la sauvegarde
            console.log("DEBUG: Objet à sauvegarder:", JSON.stringify(dataToSave, null, 2));

            newResultsToSave.push({
                predictionId: prediction.id,
                data: dataToSave
            });

            if (result === 'WON') {
                report.summary.won++;
                wonCount++;
            }
            if (result === 'LOST') {
                report.summary.lost++;
                lostCount++;
            }
            if (report.summary.pending > 0) report.summary.pending--;
        }
    }
    
    if (newResultsToSave.length > 0) {
        console.log(chalk.cyan(`   -> Sauvegarde de ${newResultsToSave.length} nouveaux résultats...`));
        await firestoreService.saveResultsBatch(executionId, newResultsToSave);

        if (report.summary.pending === 0) {
            report.status = 'COMPLETED';
            console.log(chalk.green.bold(`   -> Rapport pour ${executionId} est maintenant complet !`));
        }
        report.lastUpdatedAt = new Date();
        
        const { results, ...reportToSave } = report;
        await firestoreService.savePredictionReport(executionId, reportToSave);

    } else {
        console.log(chalk.yellow(`Aucun nouveau résultat de match terminé à traiter.`));
    }
    
    const totalProcessedInRun = wonCount + lostCount;
    const successRate = totalProcessedInRun > 0 ? ((wonCount / totalProcessedInRun) * 100).toFixed(2) : 0;
    
    let finalMessage = `Job de Vérification des Résultats Terminé. Total prédictions cycle: ${report.summary.total}.`;

    if (totalProcessedInRun > 0) {
        finalMessage += ` Matchs terminés et analysés: ${totalProcessedInRun} (Gagnés: ${wonCount}, Perdus: ${lostCount}, Taux de réussite: ${successRate}%).`;
    } else {
        finalMessage += ` Aucun nouveau match terminé à analyser.`;
    }

    console.log(chalk.blue.bold(`\n--- ${finalMessage} ---`));
    const finalHtml = await generateHtmlReport({ [executionId]: report });
    res.status(200).send(finalHtml);
});