const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('../common/services/Firestore.service');
const { footballConfig } = require('../common/config/football.config');
const { gestionJourneeService } = require('../common/services/GestionJournee.service');
const { analyseMatchService } = require('../common/services/AnalyseMatch.service');
const axios = require('axios');

function getTrancheKey(score) {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    if (score >= 0) return "0-59";
    return null;
}

const initTrancheAnalysis = () => ({
    '0-59': { success: 0, total: 0 },
    '60-69': { success: 0, total: 0 },
    '70-79': { success: 0, total: 0 },
    '80-89': { success: 0, total: 0 },
    '90-100': { success: 0, total: 0 },
});

function determineMarketResult(match, market) {
    const { goals, score } = match;
    const homeGoals = goals.home;
    const awayGoals = goals.away;
    const totalGoals = homeGoals + awayGoals;

    if (market.startsWith('match_over_')) {
        const value = parseFloat(market.split('_')[2]);
        return totalGoals > value ? 'WON' : 'LOST';
    }
    
    switch (market) {
        case 'favorite_win':
            const homeOdd = score.fulltime.home < score.fulltime.away;
            return (homeOdd && homeGoals > awayGoals) || (!homeOdd && awayGoals > homeGoals) ? 'WON' : 'LOST';
        case 'btts':
            return homeGoals > 0 && awayGoals > 0 ? 'WON' : 'LOST';
        default:
            return 'PENDING';
    }
}


functions.http('runBacktestingAndStrategy', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Backtesting & Stratégie ---"));

    const allBacktestResults = [];
    const season = new Date().getFullYear();

    for (const league of footballConfig.leaguesToAnalyze) {
        console.log(chalk.cyan(`\n[Backtest] Analyse de la ligue : ${league.name}`));
        const finishedMatches = await gestionJourneeService.getMatchesForBacktesting(league.id, season);

        if (finishedMatches && finishedMatches.length > 0) {
            for (const match of finishedMatches) {
                const analysis = await analyseMatchService.analyseMatch(match);
                if (analysis && analysis.markets) {
                    const matchResults = [];
                    for (const market in analysis.markets) {
                        const predictionScore = analysis.markets[market];
                        const result = determineMarketResult(match, market);
                        if(result !== 'PENDING') {
                            matchResults.push({
                                market: market,
                                prediction: predictionScore,
                                result: result
                            });
                        }
                    }
                    allBacktestResults.push({
                        matchId: match.fixture.id,
                        markets: matchResults
                    });
                }
            }
        }
    }
    
    if (allBacktestResults.length === 0) {
        console.log(chalk.yellow("Aucun résultat de backtest à analyser. Déclenchement de la suite..."));
        try {
            const predictionFunctionUrl = process.env.PREDICTION_FUNCTION_URL;
            if (predictionFunctionUrl && predictionFunctionUrl !== 'placeholder') {
                 await axios.get(predictionFunctionUrl, { timeout: 300000 });
                 res.status(200).send("Aucun backtest, prédiction déclenchée.");
            } else {
                 res.status(200).send("Aucun backtest, URL de prédiction non configurée.");
            }
        } catch (error) {
            console.error(chalk.red("Erreur lors du déclenchement de la fonction de prédiction :"), error.message);
            res.status(500).send("Erreur lors du déclenchement de la fonction suivante.");
        }
        return;
    }

    const perMarketSummary = {};
    for (const result of allBacktestResults) {
        if (result && Array.isArray(result.markets)) {
            for (const marketData of result.markets) {
                const { market, prediction, result: winStatus } = marketData;
                if (!market || typeof prediction !== 'number' || !winStatus) continue;

                if (!perMarketSummary[market]) {
                    perMarketSummary[market] = initTrancheAnalysis();
                }

                const trancheKey = getTrancheKey(prediction);
                if (trancheKey) {
                    const tranche = perMarketSummary[market][trancheKey];
                    if (tranche) {
                        tranche.total++;
                        if (winStatus === 'WON') {
                            tranche.success++;
                        }
                    }
                }
            }
        }
    }

    console.log(chalk.cyan("Génération de la whitelist (taux > 85%)..."));
    const WHITELIST_SUCCESS_RATE = 0.85;
    const whitelist = {};
    for (const market in perMarketSummary) {
        for (const key in perMarketSummary[market]) {
            const tranche = perMarketSummary[market][key];
            if (tranche.total > 0) { 
                const successRate = tranche.success / tranche.total;
                if (successRate > WHITELIST_SUCCESS_RATE) {
                    if (!whitelist[market]) {
                        whitelist[market] = [];
                    }
                    whitelist[market].push(key);
                }
            }
        }
    }

    await firestoreService.saveWhitelist(whitelist);
    console.log(chalk.magenta.bold(`-> Whitelist sauvegardée avec ${Object.keys(whitelist).length} marchés.`));
    
    try {
        console.log(chalk.green("Déclenchement de la fonction de prédiction..."));
        const predictionFunctionUrl = process.env.PREDICTION_FUNCTION_URL;
        if (predictionFunctionUrl && predictionFunctionUrl !== 'placeholder') {
            await axios.get(predictionFunctionUrl, { timeout: 300000 });
            res.status(200).send("Backtesting terminé, prédiction déclenchée.");
        } else {
            console.log(chalk.yellow("URL de la fonction de prédiction non configurée. Arrêt de la chaîne."));
            res.status(200).send("Backtesting terminé, URL de prédiction non configurée.");
        }
    } catch (error) {
        console.error(chalk.red("Erreur lors du déclenchement de la fonction de prédiction :"), error.message);
        res.status(500).send("Erreur lors du déclenchement de la fonction suivante.");
    }
});