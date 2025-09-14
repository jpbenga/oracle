const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('../common/services/Firestore.service');
const { apiFootballService } = require('../common/services/ApiFootball.service');

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
        // Match
        results[`match_over_${t}`] = (ff.home + ff.away > t) ? 'WON' : 'LOST';
        results[`match_under_${t}`] = (ff.home + ff.away < t) ? 'WON' : 'LOST';
        // Halftime
        results[`ht_over_${t}`] = (fh.home + fh.away > t) ? 'WON' : 'LOST';
        results[`ht_under_${t}`] = (fh.home + fh.away < t) ? 'WON' : 'LOST';
        // Secondtime
        results[`st_over_${t}`] = (sh.home + sh.away > t) ? 'WON' : 'LOST';
        results[`st_under_${t}`] = (sh.home + sh.away < t) ? 'WON' : 'LOST';
        // Home
        results[`home_over_${t}`] = (ff.home > t) ? 'WON' : 'LOST';
        results[`home_under_${t}`] = (ff.home < t) ? 'WON' : 'LOST';
        // Away
        results[`away_over_${t}`] = (ff.away > t) ? 'WON' : 'LOST';
        results[`away_under_${t}`] = (ff.away < t) ? 'WON' : 'LOST';
        // Home Halftime
        results[`home_ht_over_${t}`] = (fh.home > t) ? 'WON' : 'LOST';
        results[`home_ht_under_${t}`] = (fh.home < t) ? 'WON' : 'LOST';
        // Away Halftime
        results[`away_ht_over_${t}`] = (fh.away > t) ? 'WON' : 'LOST';
        results[`away_ht_under_${t}`] = (fh.away < t) ? 'WON' : 'LOST';
        // Home Secondtime
        results[`home_st_over_${t}`] = (sh.home > t) ? 'WON' : 'LOST';
        results[`home_st_under_${t}`] = (sh.home < t) ? 'WON' : 'LOST';
        // Away Secondtime
        results[`away_st_over_${t}`] = (sh.away > t) ? 'WON' : 'LOST';
        results[`away_st_under_${t}`] = (sh.away < t) ? 'WON' : 'LOST';
    });
    return results;
}

function generateHtmlReport(reports) {
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

    if (Object.keys(reports).length === 0) {
        body += `<p>Aucun rapport de prédiction à afficher.</p>`;
    }

    for (const executionId in reports) {
        const report = reports[executionId];
        const summary = report.summary;
        body += `
            <div class="report-container">
                <h2>Rapport pour l'exécution : ${executionId.substring(0, 20)}...</h2>
                <div class="summary">
                    <span>Total: ${summary.total}</span>
                    <span class="status-WON">Gagnés: ${summary.won}</span>
                    <span class="status-LOST">Perdus: ${summary.lost}</span>
                    <span>En attente: ${summary.pending}</span>
                </div>`;

        const resultsByLeague = Object.values(report.results).reduce((acc, res) => {
            const league = res.leagueName || 'Inconnue';
            if (!acc[league]) acc[league] = [];
            acc[league].push(res);
            return acc;
        }, {});

        for (const league in resultsByLeague) {
            body += `<h3>${league}</h3>
                     <table>
                        <thead>
                            <tr>
                                <th>Match</th>
                                <th>Marché</th>
                                <th>Confiance</th>
                                <th>Score Final</th>
                                <th>Résultat</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            const sortedResults = resultsByLeague[league].sort((a, b) => {
                if (a.matchLabel < b.matchLabel) return -1;
                if (a.matchLabel > b.matchLabel) return 1;
                if (a.market < b.market) return -1;
                if (a.market > b.market) return 1;
                return 0;
            });

            sortedResults.forEach(res => {
                body += `
                    <tr>
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
    }

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport de Vérification</title><style>${css}</style></head><body>${body}</body></html>`;
}

functions.http('resultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Résultats ---"));

    const pendingPredictions = await firestoreService.getPredictionsWithoutFinalResult();
    if (!pendingPredictions.length) {
        const html = generateHtmlReport({});
        res.status(200).send(html);
        return;
    }

    const predictionsByRun = pendingPredictions.reduce((acc, pred) => {
        const execId = pred.backtestExecutionId;
        if (execId) {
            if (!acc[execId]) acc[execId] = [];
            acc[execId].push(pred);
        }
        return acc;
    }, {});

    const processedReports = {};

    for (const executionId in predictionsByRun) {
        console.log(chalk.cyan(`\nTraitement du lot d'exécution : ${executionId}`));
        const predictionsForRun = predictionsByRun[executionId];
        const fixtureIdsToCheck = [...new Set(predictionsForRun.map(p => p.fixtureId))];

        let report = await firestoreService.getPredictionReport(executionId);
        if (!report) {
            report = {
                executionId: executionId,
                createdAt: new Date(),
                status: 'PROCESSING',
                summary: { total: predictionsForRun.length, won: 0, lost: 0, pending: predictionsForRun.length },
                results: {}
            };
        }

        const fixturesToQuery = fixtureIdsToCheck.filter(id => !report.results[id]);
        if (fixturesToQuery.length === 0) {
            console.log(chalk.gray(`   -> Aucun nouveau match à vérifier pour ce lot.`));
            processedReports[executionId] = report;
            continue;
        }

        const fixtures = [];
        console.log(chalk.cyan(`   -> Récupération des résultats pour ${fixturesToQuery.length} matchs...`));
        for (const id of fixturesToQuery) {
            const fixture = await apiFootballService.getMatchById(id);
            if (fixture) fixtures.push(fixture);
            await new Promise(resolve => setTimeout(resolve, 300)); // Délai pour ne pas surcharger l'API
        }

        if (fixtures.length === 0) {
            console.log(chalk.yellow(`   -> Impossible de récupérer les détails des matchs pour le lot ${executionId}.`));
            processedReports[executionId] = report;
            continue;
        }

        let reportUpdated = false;
        for (const prediction of predictionsForRun) {
            const fixtureIdStr = String(prediction.fixtureId);
            const fixture = fixtures.find(f => f.fixture.id === prediction.fixtureId);

            if (!report.results[fixtureIdStr] && fixture && fixture.fixture.status.short === 'FT') {
                reportUpdated = true;
                const allMarketResults = determineResultsFromFixture(fixture);
                const result = allMarketResults[prediction.market] || 'UNKNOWN';
                
                report.results[fixtureIdStr] = {
                    market: prediction.market,
                    score: prediction.score,
                    odd: prediction.odd,
                    matchLabel: prediction.matchLabel,
                    leagueName: prediction.leagueName,
                    finalScore: { home: fixture.goals.home, away: fixture.goals.away },
                    result: result
                };

                if (result === 'WON') report.summary.won++;
                if (result === 'LOST') report.summary.lost++;
                report.summary.pending--;
                console.log(chalk.green(`   -> Résultat pour ${prediction.matchLabel} (${prediction.market}): ${result}`));
            }
        }

        if (reportUpdated) {
            if (report.summary.pending === 0) {
                report.status = 'COMPLETED';
                console.log(chalk.green.bold(`   -> Rapport pour ${executionId} est maintenant complet !`));
            }
            report.lastUpdatedAt = new Date();
            await firestoreService.savePredictionReport(executionId, report);
        }
        processedReports[executionId] = report;
    }
    
    console.log(chalk.blue.bold("\n--- Job de Vérification des Résultats Terminé ---"));
    const finalHtml = generateHtmlReport(processedReports);
    res.status(200).send(finalHtml);
});