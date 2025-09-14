const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');
const { apiFootballService } = require('./common/services/ApiFootball.service');

// Cette fonction détermine le résultat d'un pari pour un marché donné
function determineMarketResult(fixture, market) {
    const ff = fixture.goals;
    if (ff.home === null || ff.away === null) return 'PENDING';

    const didHomeWin = ff.home > ff.away;
    const didAwayWin = ff.away > ff.home;
    const wasDraw = ff.home === ff.away;

    switch (market) {
        case 'home_win': return didHomeWin ? 'WON' : 'LOST';
        case 'away_win': return didAwayWin ? 'WON' : 'LOST';
        case 'draw': return wasDraw ? 'WON' : 'LOST';
        case 'btts': return (ff.home > 0 && ff.away > 0) ? 'WON' : 'LOST';
        case 'btts_no': return (ff.home > 0 && ff.away > 0) ? 'LOST' : 'WON';
        // Ajoutez d'autres cas pour les marchés 'over'/'under' si nécessaire
        default:
            if (market.includes('match_over_')) {
                const value = parseFloat(market.replace('match_over_', ''));
                return (ff.home + ff.away) > value ? 'WON' : 'LOST';
            }
            if (market.includes('match_under_')) {
                const value = parseFloat(market.replace('match_under_', ''));
                return (ff.home + ff.away) < value ? 'WON' : 'LOST';
            }
            return 'UNKNOWN';
    }
}

functions.http('resultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Résultats ---"));

    // 1. Récupérer toutes les prédictions qui ne sont pas encore dans un rapport final
    const pendingPredictions = await firestoreService.getPredictionsWithoutFinalResult();
    if (!pendingPredictions.length) {
        console.log(chalk.green("Aucune prédiction en attente de résultat. Terminé."));
        res.status(200).send("No pending predictions.");
        return;
    }

    // 2. Grouper les prédictions par 'backtestExecutionId'
    const predictionsByRun = pendingPredictions.reduce((acc, pred) => {
        const execId = pred.backtestExecutionId;
        if (execId) {
            if (!acc[execId]) acc[execId] = [];
            acc[execId].push(pred);
        }
        return acc;
    }, {});

    // 3. Traiter chaque lot de prédictions
    for (const executionId in predictionsByRun) {
        console.log(chalk.cyan(`\nTraitement du lot d'exécution : ${executionId}`));
        const predictionsForRun = predictionsByRun[executionId];
        const fixtureIds = [...new Set(predictionsForRun.map(p => p.fixtureId))];

        // 4. Récupérer les résultats des matchs depuis l'API
        const fixtures = await apiFootballService.getFixturesByIds(fixtureIds);
        if (!fixtures || fixtures.length === 0) {
            console.log(chalk.yellow(`   -> Impossible de récupérer les détails des matchs pour le lot ${executionId}.`));
            continue;
        }

        // 5. Charger ou créer le rapport de prédiction
        let report = await firestoreService.getPredictionReport(executionId);
        if (!report) {
            report = {
                executionId: executionId,
                createdAt: new Date(),
                status: 'PROCESSING',
                summary: { total: predictionsForRun.length, won: 0, lost: 0, pending: predictionsForRun.length },
                results: {} // Clé: fixtureId
            };
        }

        let reportUpdated = false;
        // 6. Mettre à jour le rapport avec les nouveaux résultats
        for (const prediction of predictionsForRun) {
            const fixtureIdStr = String(prediction.fixtureId);
            const fixture = fixtures.find(f => f.fixture.id === prediction.fixtureId);

            // Si le résultat n'est pas déjà dans le rapport et que le match est terminé
            if (!report.results[fixtureIdStr] && fixture && fixture.fixture.status.short === 'FT') {
                reportUpdated = true;
                const result = determineMarketResult(fixture, prediction.market);
                
                report.results[fixtureIdStr] = {
                    market: prediction.market,
                    score: prediction.score,
                    odd: prediction.odd,
                    matchLabel: prediction.matchLabel,
                    finalScore: { home: fixture.goals.home, away: fixture.goals.away },
                    result: result
                };

                if (result === 'WON') report.summary.won++;
                if (result === 'LOST') report.summary.lost++;
                report.summary.pending--;
                console.log(chalk.green(`   -> Résultat pour ${prediction.matchLabel} (${prediction.market}): ${result}`));
            }
        }

        // 7. Sauvegarder le rapport mis à jour
        if (reportUpdated) {
            if (report.summary.pending === 0) {
                report.status = 'COMPLETED';
                console.log(chalk.green.bold(`   -> Rapport pour ${executionId} est maintenant complet !`));
            }
            report.lastUpdatedAt = new Date();
            await firestoreService.savePredictionReport(executionId, report);
        } else {
            console.log(chalk.gray(`   -> Aucun nouveau résultat pour le lot ${executionId}.`));
        }
    }
    
    // NOTE : La logique pour les rapports de tickets suivrait un schéma très similaire et peut être ajoutée ici.
    
    console.log(chalk.blue.bold("\n--- Job de Vérification des Résultats Terminé ---"));
    res.status(200).send("Results checker finished successfully.");
});