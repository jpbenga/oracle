const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');
const { footballConfig } = require('./common/config/football.config');
const { gestionJourneeService } = require('./common/services/GestionJournee.service');
const { analyseMatchService } = require('./common/services/AnalyseMatch.service');
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

function generateBacktestingHtml(summary, whitelist) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; color: #333; margin: 0; padding: 20px; }
        h1, h2 { color: #1d2129; border-bottom: 2px solid #e9ebee; padding-bottom: 10px; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; margin-top: 40px;}
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); background: #fff; }
        th, td { padding: 12px 15px; text-align: left; border: 1px solid #e9ebee; }
        thead { background-color: #333; color: #fff; }
        tbody tr:nth-child(even) { background-color: #f6f7f9; }
        tbody tr:hover { background-color: #e9ebee; }
        .container { max-width: 1400px; margin: auto; background: #fff; padding: 20px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .rate { font-weight: bold; }
        .rate-high { color: #28a745; }
        .rate-medium { color: #f0ad4e; }
        .rate-low { color: #d9534f; }
        .whitelist-box { background-color: #e9f7ef; border-left: 5px solid #28a745; padding: 15px; margin-top: 20px; border-radius: 5px; }
        .no-data { text-align: center; padding: 20px; font-style: italic; color: #888; }
    `;

    let summaryHtml = '<h2>Analyse par Marché et Tranche de Confiance</h2><table><thead><tr><th>Marché</th><th>Tranche</th><th>Taux de Réussite</th><th>Succès</th><th>Total</th></tr></thead><tbody>';
    const sortedMarkets = Object.keys(summary).sort();

    for (const market of sortedMarkets) {
        const sortedTranches = Object.keys(summary[market]).sort((a, b) => {
            const aVal = parseInt(a.split('-')[0]);
            const bVal = parseInt(b.split('-')[0]);
            return bVal - aVal;
        });

        for (const tranche of sortedTranches) {
            const data = summary[market][tranche];
            if (data.total === 0) continue;
            const rate = (data.success / data.total) * 100;
            let rateClass = 'rate-low';
            if (rate >= 85) rateClass = 'rate-high';
            else if (rate >= 70) rateClass = 'rate-medium';
            
            summaryHtml += `
                <tr>
                    <td>${market}</td>
                    <td><b>${tranche}%</b></td>
                    <td class="rate ${rateClass}">${rate.toFixed(2)}%</td>
                    <td>${data.success}</td>
                    <td>${data.total}</td>
                </tr>
            `;
        }
    }
    summaryHtml += '</tbody></table>';

    let whitelistHtml = '<h2>Whitelist Générée (&gt;85% de réussite)</h2>';
    if (Object.keys(whitelist).length > 0) {
        whitelistHtml += '<table><thead><tr><th>Marché</th><th>Tranches Validées</th></tr></thead><tbody>';
        const sortedWhitelistMarkets = Object.keys(whitelist).sort();
        for (const market of sortedWhitelistMarkets) {
            whitelistHtml += `
                <tr>
                    <td>${market}</td>
                    <td><b>${whitelist[market].join(', ')}</b></td>
                </tr>
            `;
        }
        whitelistHtml += '</tbody></table>';
    } else {
        whitelistHtml += '<div class="no-data"><p>Aucun marché n\'a atteint le seuil de 85% pour être ajouté à la whitelist.</p></div>';
    }

    return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Rapport de Backtesting</title>
            <style>${css}</style>
        </head>
        <body>
            <div class="container">
                <h1>Rapport de Backtesting</h1>
                ${summaryHtml}
                ${whitelistHtml}
            </div>
        </body>
        </html>
    `;
}


functions.http('runBacktestingAndStrategy', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Backtesting & Stratégie ---"));

    const isDbConnected = await firestoreService.testConnection();
    if (!isDbConnected) {
        console.error(chalk.red.bold("Arrêt du job : la connexion à Firestore a échoué."));
        res.status(500).send("CRITICAL: Firestore connection failed.");
        return;
    }

    const allBacktestResults = [];
    const season = new Date().getFullYear();

    for (const league of footballConfig.leaguesToAnalyze) {
        console.log(chalk.cyan(`
[Backtest] Analyse de la ligue : ${league.name}`));
        const finishedMatches = await gestionJourneeService.getMatchesForBacktesting(league.id, season);

        if (finishedMatches && finishedMatches.length > 0) {
            for (const match of finishedMatches) {
                console.log(chalk.green(`   -> Analyse du match : ${match.teams.home.name} vs ${match.teams.away.name}`));
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
        const html = generateBacktestingHtml({}, {});
        res.status(200).send(html);
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
    
    const htmlResponse = generateBacktestingHtml(perMarketSummary, whitelist);
    res.status(200).send(htmlResponse);

    // try {
    //     console.log(chalk.green("Déclenchement de la fonction de prédiction..."));
    //     const predictionFunctionUrl = process.env.PREDICTION_FUNCTION_URL;
    //     if (predictionFunctionUrl && predictionFunctionUrl !== 'placeholder') {
    //         await axios.get(predictionFunctionUrl, { timeout: 300000 });
    //         res.status(200).send("Backtesting terminé, prédiction déclenchée.");
    //     } else {
    //         console.log(chalk.yellow("URL de la fonction de prédiction non configurée. Arrêt de la chaîne."));
    //         res.status(200).send("Backtesting terminé, URL de prédiction non configurée.");
    //     }
    // } catch (error) {
    //     console.error(chalk.red("Erreur lors du déclenchement de la fonction de prédiction : "), error.message);
    //     res.status(500).send("Erreur lors du déclenchement de la fonction suivante.");
    // }
});