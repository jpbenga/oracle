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

async function generateHtmlReport(reports) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        h1, h2, h3 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; }
        .report-container { background-color: #1e1e1e; border: 1px solid #373737; border-radius: 8px; margin-bottom: 30px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #373737; }
        th { background-color: #2a2a2a; }
        .status-WON { color: #03dac6; font-weight: bold; }
        .status-LOST { color: #cf6679; font-weight: bold; }
        .status-PENDING { color: #f0e68c; }
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
        
        const allResults = await firestoreService.getReportResults(executionId);

        body += `
            <div class="report-container">
                <h2>Rapport pour l'exécution : ${executionId.substring(0, 20)}...</h2>
                <div class="summary">
                    <span>Total: ${summary.total}</span>
                    <span class="status-WON">Gagnés: ${summary.won}</span>
                    <span class="status-LOST">Perdus: ${summary.lost}</span>
                    <span>En attente: ${summary.pending}</span>
                </div>`;

        const resultsByLeague = allResults.reduce((acc, res) => {
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

    const latestRun = await firestoreService.getLatestBacktestRun();
    if (!latestRun) {
        console.log(chalk.yellow("Aucun cycle d'exécution (backtest_run) trouvé."));
        const html = await generateHtmlReport({});
        res.status(200).send(html);
        return;
    }
    const executionId = latestRun.executionId;
    console.log(chalk.cyan(`Ciblage du dernier cycle d'exécution : ${executionId}`));

    // --- DEBUT DE LA LOGIQUE DE VERROUILLAGE ---
    const report = await firestoreService.getPredictionReport(executionId);
    
    if (report && (report.status === 'PROCESSING' || report.status === 'COMPLETED')) {
        const message = `Le rapport pour ${executionId} est déjà complet ou en cours de traitement (statut: ${report.status}). Arrêt de la fonction.`;
        console.log(chalk.yellow.bold(message));
        // Si le rapport est complet, on le renvoie, sinon juste un message.
        if (report.status === 'COMPLETED') {
            const finalHtml = await generateHtmlReport({ [executionId]: report });
            res.status(200).send(finalHtml);
        } else {
            res.status(200).send(message);
        }
        return;
    }

    // Verrouillage du rapport en le passant au statut PROCESSING
    const predictionsForRun = await firestoreService.getPredictionsForRun(executionId);
    let reportToProcess;
    if (!report) {
        reportToProcess = {
            executionId: executionId,
            createdAt: new Date(),
            status: 'PROCESSING',
            summary: { total: predictionsForRun.length, won: 0, lost: 0, pending: predictionsForRun.length },
        };
    } else {
        reportToProcess = report;
        reportToProcess.status = 'PROCESSING';
    }
    await firestoreService.savePredictionReport(executionId, { 
        status: reportToProcess.status,
        lastUpdatedAt: new Date(),
        createdAt: reportToProcess.createdAt || new Date(),
        summary: reportToProcess.summary || { total: predictionsForRun.length, won: 0, lost: 0, pending: predictionsForRun.length },
     });
    console.log(chalk.magenta(`Verrouillage du rapport ${executionId} avec le statut PROCESSING.`));
    // --- FIN DE LA LOGIQUE DE VERROUILLAGE ---

    console.log(chalk.white.bold(`   -> ${predictionsForRun.length} prédiction(s) trouvée(s) pour ce cycle.`));
    
    const existingResults = await firestoreService.getReportResults(executionId);
    const existingResultIds = new Set(existingResults.map(r => r.predictionId));

    const predictionsToProcess = predictionsForRun.filter(p => !existingResultIds.has(p.id));
    
    if (predictionsToProcess.length === 0) {
        console.log(chalk.gray(`Toutes les prédictions pour ce cycle ont déjà un résultat.`));
        // On s'assure que le rapport final est bien marqué comme COMPLET
        reportToProcess.status = 'COMPLETED';
        await firestoreService.savePredictionReport(executionId, { status: 'COMPLETED' });
        const finalHtml = await generateHtmlReport({ [executionId]: reportToProcess });
        res.status(200).send(finalHtml);
        return;
    }

    const fixtureIdsToQuery = [...new Set(predictionsToProcess.map(p => p.fixtureId))];
    console.log(chalk.cyan(`   -> Récupération des résultats pour ${fixtureIdsToQuery.length} match(s) unique(s)...`));
    
    const fixturesData = [];
    for (const id of fixtureIdsToQuery) {
        const fixture = await apiFootballService.getMatchById(id);
        if (fixture) fixturesData.push(fixture);
    }

    const fixtureResultsMap = {};
    fixturesData.forEach(fixture => {
        if (fixture.fixture.status.short === 'FT') {
            fixtureResultsMap[fixture.fixture.id] = determineResultsFromFixture(fixture);
        }
    });

    const newResultsToSave = [];
    const processedPredictionIds = new Set();

    // Traiter les matchs terminés
    for (const prediction of predictionsToProcess) {
        const allMarketResults = fixtureResultsMap[prediction.fixtureId];
        if (allMarketResults) {
            const result = allMarketResults[prediction.market] || 'UNKNOWN';
            const fixture = fixturesData.find(f => f.fixture.id === prediction.fixtureId);

            newResultsToSave.push({
                predictionId: prediction.id,
                data: {
                    predictionId: prediction.id,
                    market: prediction.market,
                    score: prediction.score,
                    odd: prediction.odd,
                    matchLabel: prediction.matchLabel,
                    leagueName: prediction.leagueName,
                    finalScore: { home: fixture.goals.home, away: fixture.goals.away },
                    result: result
                }
            });
            processedPredictionIds.add(prediction.id);

            if (result === 'WON') reportToProcess.summary.won++;
            if (result === 'LOST') reportToProcess.summary.lost++;
            if (reportToProcess.summary.pending > 0) reportToProcess.summary.pending--;
        }
    }

    // Identifier et ajouter les matchs non terminés (en attente)
    const pendingPredictions = predictionsToProcess.filter(p => !processedPredictionIds.has(p.id));
    for (const prediction of pendingPredictions) {
        newResultsToSave.push({
            predictionId: prediction.id,
            data: {
                predictionId: prediction.id,
                market: prediction.market,
                score: prediction.score,
                odd: prediction.odd,
                matchLabel: prediction.matchLabel,
                leagueName: prediction.leagueName,
                finalScore: null,
                result: 'PENDING' // Statut explicite pour les matchs en attente
            }
        });
    }
    
    if (newResultsToSave.length > 0) {
        console.log(chalk.cyan(`   -> Sauvegarde de ${newResultsToSave.length} nouveaux résultats...`));
        await firestoreService.saveResultsBatch(executionId, newResultsToSave);
    }

    if (reportToProcess.summary.pending === 0) {
        reportToProcess.status = 'COMPLETED';
        console.log(chalk.green.bold(`   -> Rapport pour ${executionId} est maintenant complet !`));
    }
    // Si ce n'est pas complet, le statut reste à PROCESSING pour la prochaine exécution.
    reportToProcess.lastUpdatedAt = new Date();
    
    // On ne sauvegarde que les champs que l'on veut mettre à jour
    await firestoreService.savePredictionReport(executionId, {
        status: reportToProcess.status,
        summary: reportToProcess.summary,
        lastUpdatedAt: reportToProcess.lastUpdatedAt
    });
    
    console.log(chalk.blue.bold("\n--- Job de Vérification des Résultats Terminé ---"));
    const finalHtml = await generateHtmlReport({ [executionId]: reportToProcess });
    res.status(200).send(finalHtml);
});