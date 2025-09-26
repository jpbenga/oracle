// Force git to detect changes
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

functions.http('resultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Résultats ---"));

    // Get predictions from the last 48 hours
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2); // 2 days to be safe

    const allRecentPredictions = await firestoreService.getPredictionsFromDateRange(yesterday, today);
    if (!allRecentPredictions || allRecentPredictions.length === 0) {
        console.log(chalk.yellow("Aucune prédiction récente à vérifier."));
        res.status(200).send("Aucune prédiction récente à vérifier.");
        return;
    }
    
    console.log(chalk.white.bold(`   -> ${allRecentPredictions.length} prédiction(s) récente(s) trouvée(s).`));

    const predictionsToProcess = allRecentPredictions.filter(p => p.result === null || p.result === undefined || p.result === 'UNKNOWN');
    
    if (predictionsToProcess.length === 0) {
        console.log(chalk.gray("Toutes les prédictions récentes ont déjà un résultat."));
        res.status(200).send("Toutes les prédictions récentes ont déjà un résultat.");
        return;
    }

    console.log(chalk.cyan(`   -> ${predictionsToProcess.length} prédiction(s) à traiter.`));

    const fixtureIdsToQuery = [...new Set(predictionsToProcess.map(p => p.fixtureId))];
    console.log(chalk.cyan(`   -> Récupération des résultats pour ${fixtureIdsToQuery.length} match(s) unique(s)...`));
    
    const fixturesData = await apiFootballService.getFixturesByIds(fixtureIdsToQuery);

    const fixtureResultsMap = {};
    if (fixturesData) {
        fixturesData.forEach(fixture => {
            if (fixture.fixture.status.short === 'FT') {
                fixtureResultsMap[fixture.fixture.id] = determineResultsFromFixture(fixture);
            }
        });
    } else {
        console.log(chalk.red(`   -> Impossible de récupérer les données des matchs depuis l'API. Le traitement des résultats est annulé pour ce cycle.`));
    }

    const predictionUpdates = [];
    let wonCount = 0;
    let lostCount = 0;

    console.log(chalk.blue.bold(`\n--- Analyse détaillée des ${predictionsToProcess.length} prédiction(s) à traiter ---`));
    for (const prediction of predictionsToProcess) {
        const matchInfo = `${prediction.home_team?.name || 'Equipe Inconnue'} vs ${prediction.away_team?.name || 'Equipe Inconnue'}`;
        console.log(chalk.cyan(`\n-> Analyse de la prédiction ID: ${prediction.id}`));
        console.log(chalk.white(`   Match: ${matchInfo} (Fixture ID: ${prediction.fixtureId})`));
        console.log(chalk.white(`   Marché: ${prediction.market}`));

        const allMarketResults = fixtureResultsMap[prediction.fixtureId];
        if (allMarketResults) {
            const result = allMarketResults[prediction.market] || 'UNKNOWN';
            console.log(chalk.white(`   Résultat trouvé pour ce marché: ${result}`));
            
            if (result === 'WON' || result === 'LOST') {
                console.log(chalk.green(`   -> Préparation de la mise à jour: { id: ${prediction.id}, result: ${result} }`));
                predictionUpdates.push({ predictionId: prediction.id, result });
                if (result === 'WON') wonCount++;
                if (result === 'LOST') lostCount++;
            } else {
                console.log(chalk.yellow(`   -> Aucun résultat concluant (WON/LOST) trouvé pour ce marché. Pas de mise à jour.`));
            }
        } else {
            console.log(chalk.yellow(`   -> Aucun résultat de match terminé trouvé pour la fixture ID ${prediction.fixtureId}.`));
        }
    }
    console.log(chalk.blue.bold(`\n--- Fin de l'analyse détaillée ---`));

    if (predictionUpdates.length > 0) {
        console.log(chalk.magenta(`\n--- Préparation de la mise à jour groupée pour ${predictionUpdates.length} prédictions... ---`));
        console.log(chalk.white(JSON.stringify(predictionUpdates, null, 2)));
        await firestoreService.batchUpdatePredictionResults(predictionUpdates);
        console.log(chalk.magenta.bold(`--- Mise à jour groupée terminée. ---`));
    }
    
    const totalProcessedInRun = wonCount + lostCount;
    let finalMessage = `Job de Vérification des Résultats Terminé.`;

    if (totalProcessedInRun > 0) {
        finalMessage += ` ${totalProcessedInRun} prédiction(s) mise(s) à jour (Gagnés: ${wonCount}, Perdus: ${lostCount}).`;
    } else {
        finalMessage += ` Aucun nouveau résultat de match terminé à traiter.`;
    }

    console.log(chalk.blue.bold(`\n--- ${finalMessage} ---`));
    res.status(200).send(finalMessage);
});
