const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');
const { footballConfig } = require('./common/config/football.config');
const { gestionJourneeService } = require('./common/services/GestionJournee.service');
const { analyseMatchService } = require('./common/services/AnalyseMatch.service');

const initTrancheAnalysis = () => ({
    '0-59': { success: 0, total: 0, predictionSum: 0 },
    '60-69': { success: 0, total: 0, predictionSum: 0 },
    '70-79': { success: 0, total: 0, predictionSum: 0 },
    '80-89': { success: 0, total: 0, predictionSum: 0 },
    '90-100': { success: 0, total: 0, predictionSum: 0 },
});

function getTrancheKey(score) {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    if (score >= 0) return "0-59";
    return null;
}

function determineAllMarketResults(fixture, projectedHomeGoals, projectedAwayGoals) {
    const results = {};
    const ff = fixture.goals;
    const fh = fixture.score.halftime;
    if (ff.home === null || ff.away === null || fh.home === null || fh.away === null) return {};

    const didHomeWin = ff.home > ff.away;
    const didAwayWin = ff.away > ff.home;
    const wasDraw = ff.home === ff.away;
    const isHomeFavoriteModel = projectedHomeGoals > projectedAwayGoals;

    results['draw'] = wasDraw ? 'WON' : 'LOST';
    results['home_win'] = didHomeWin ? 'WON' : 'LOST';
    results['away_win'] = didAwayWin ? 'WON' : 'LOST';
    results['favorite_win'] = ((isHomeFavoriteModel && didHomeWin) || (!isHomeFavoriteModel && didAwayWin)) ? 'WON' : 'LOST';
    results['outsider_win'] = ((isHomeFavoriteModel && didAwayWin) || (!isHomeFavoriteModel && didHomeWin)) ? 'WON' : 'LOST';
    results['double_chance_favorite'] = (results['favorite_win'] === 'WON' || wasDraw) ? 'WON' : 'LOST';
    results['double_chance_outsider'] = (results['outsider_win'] === 'WON' || wasDraw) ? 'WON' : 'LOST';
    
    const sh = { home: ff.home - fh.home, away: ff.away - fh.away };
    results['btts'] = ff.home > 0 && ff.away > 0 ? 'WON' : 'LOST';
    results['btts_no'] = !(ff.home > 0 && ff.away > 0) ? 'WON' : 'LOST';

    [0.5, 1.5, 2.5, 3.5].forEach(t => {
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

function generateBacktestingHtml(report) {
    const { totalMatchesAnalyzed, perMarketSummary, whitelist, calibration, earlySeasonSummary } = report;
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        h1, h2, h3 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; }
        h1 { font-size: 2.2em; text-align: center; }
        h2 { font-size: 1.8em; margin-top: 40px; }
        h3 { font-size: 1.4em; margin-top: 30px; border-bottom: 1px solid #373737; }
        .status { background-color: #1e1e1e; border: 1px solid #373737; padding: 20px; border-radius: 8px; margin-bottom: 40px; text-align: center; font-size: 1.5em; font-weight: bold; }
        .grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px; }
        .card { background-color: #1e1e1e; border: 1px solid #373737; border-radius: 8px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #373737; }
        th { background-color: #2a2a2a; }
        .score { font-weight: bold; }
        .rate-high { background-color: #03dac630; }
        .rate-medium { background-color: #f0e68c30; }
        .rate-low { background-color: #cf667930; }
    `;

    const trancheKeys = ['90-100', '80-89', '70-79', '60-69', '0-59'];
    let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport de Backtest</title><style>${css}</style></head><body>`;
    html += `<h1>Rapport de Backtest</h1><div class="status">${totalMatchesAnalyzed} matchs analysés</div>`;

    const globalSummary = initTrancheAnalysis();
    for (const market in perMarketSummary) { 
        for (const key of trancheKeys) { 
            globalSummary[key].success += perMarketSummary[market][key].success; 
            globalSummary[key].total += perMarketSummary[market][key].total; 
        } 
    }
    html += `<h2>Bilan Global (Tous Marchés)</h2><div class="card"><table><thead><tr><th>Tranche</th><th>Réussite</th><th>Total</th><th>Taux</th></tr></thead><tbody>`;
    trancheKeys.forEach(key => {
        const tranche = globalSummary[key];
        const rate = tranche.total > 0 ? (tranche.success / tranche.total) * 100 : 0;
        const rateClass = rate >= 75 ? 'rate-high' : rate >= 50 ? 'rate-medium' : 'rate-low';
        html += `<tr class="${rateClass}"><td>${key}%</td><td>${tranche.success}</td><td>${tranche.total}</td><td class="score">${rate.toFixed(2)}%</td></tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<h2>Bilan Début de Saison</h2><div class="card"><table><thead><tr><th>Tranche</th><th>Réussite</th><th>Total</th><th>Taux</th></tr></thead><tbody>`;
    trancheKeys.forEach(key => {
        const tranche = earlySeasonSummary[key];
        const rate = tranche.total > 0 ? (tranche.success / tranche.total) * 100 : 0;
        const rateClass = rate >= 75 ? 'rate-high' : rate >= 50 ? 'rate-medium' : 'rate-low';
        html += `<tr class="${rateClass}"><td>${key}%</td><td>${tranche.success}</td><td>${tranche.total}</td><td class="score">${rate.toFixed(2)}%</td></tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<h2>Bilan par Marché</h2><div class="grid-container">`;
    Object.keys(perMarketSummary).sort().forEach(market => {
        html += `<div class="card"><h3>${market}</h3><table><thead><tr><th>Tranche</th><th>Réussite</th><th>Total</th><th>Taux</th><th>Conf. Moy.</th></tr></thead><tbody>`;
        trancheKeys.forEach(key => {
            const tranche = perMarketSummary[market][key];
            const rate = tranche.total > 0 ? (tranche.success / tranche.total) * 100 : 0;
            const avgPred = tranche.total > 0 ? (tranche.predictionSum / tranche.total) : 0;
            const rateClass = rate >= 85 ? 'rate-high' : rate >= 70 ? 'rate-medium' : 'rate-low';
            html += `<tr class="${rateClass}"><td>${key}%</td><td>${tranche.success}</td><td>${tranche.total}</td><td class="score">${rate.toFixed(2)}%</td><td>${avgPred.toFixed(2)}%</td></tr>`;
        });
        html += `</tbody></table></div>`;
    });
    html += `</div>`;

    html += `<h2>Whitelist Générée (>85%)</h2><div class="card"><table><thead><tr><th>Marché</th><th>Tranches Validées</th></tr></thead><tbody>`;
    Object.keys(whitelist).sort().forEach(market => {
        html += `<tr><td>${market}</td><td class="score">${whitelist[market].join(', ')}</td></tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<h2>Calibration du Modèle</h2><div class="card"><table><thead><tr><th>Marché</th><th>Tranche</th><th>Prédit</th><th>Réel</th></tr></thead><tbody>`;
    Object.keys(calibration).sort().forEach(market => {
        trancheKeys.forEach(key => {
            if (calibration[market] && calibration[market][key]) {
                const { predicted, actual } = calibration[market][key];
                html += `<tr><td>${market}</td><td>${key}%</td><td>${predicted}%</td><td>${actual}%</td></tr>`;
            }
        });
    });
    html += `</tbody></table></div>`;

    html += `</body></html>`;
    return html;
}

functions.http('backtesting-and-strategy', async (req, res) => {
    console.log(chalk.blue.bold("---" + " Démarrage du Job de Backtesting & Stratégie " + "---"));

    const isDbConnected = await firestoreService.testConnection();
    if (!isDbConnected) {
        res.status(500).send("CRITICAL: Firestore connection failed.");
        return;
    }

    let totalMatchesAnalyzed = 0;
    const perMarketSummary = {};
    const earlySeasonTrancheSummary = initTrancheAnalysis();
    const allBacktestResults = [];
    const season = new Date().getFullYear();

    for (const league of footballConfig.leaguesToAnalyze) {
        console.log(chalk.cyan(`\n[Backtest] Analyse de la ligue : ${league.name}`));
        const finishedMatches = await gestionJourneeService.getMatchesForBacktesting(league.id, season);

        if (finishedMatches && finishedMatches.length > 0) {
            for (const match of finishedMatches) {
                const analysis = await analyseMatchService.analyseMatch(match);
                if (!analysis || !analysis.homeStats) continue;

                totalMatchesAnalyzed++;
                const isEarlySeason = analysis.homeStats.fixtures.played.total < 6;
                const allMarketResults = determineAllMarketResults(match, analysis.projectedHomeGoals, analysis.projectedAwayGoals);
                
                const matchResults = [];
                for (const market in analysis.markets) {
                    const result = allMarketResults[market];
                    if(result) {
                        matchResults.push({ market: market, prediction: analysis.markets[market], result: result });
                    }
                }
                allBacktestResults.push({ matchId: match.fixture.id, markets: matchResults, isEarlySeason: isEarlySeason });
            }
        }
    }
    
    if (allBacktestResults.length === 0) {
        res.status(200).send(generateBacktestingHtml({ perMarketSummary: {}, whitelist: {}, calibration: {}, totalMatchesAnalyzed: 0, earlySeasonSummary: initTrancheAnalysis() }));
        return;
    }

    for (const result of allBacktestResults) {
        for (const marketData of result.markets) {
            const { market, prediction, result: winStatus } = marketData;
            if (!market || typeof prediction !== 'number' || !winStatus) continue;

            if (!perMarketSummary[market]) perMarketSummary[market] = initTrancheAnalysis();

            const trancheKey = getTrancheKey(prediction);
            if (trancheKey) {
                const tranche = perMarketSummary[market][trancheKey];
                tranche.total++;
                tranche.predictionSum += prediction;
                if (winStatus === 'WON') tranche.success++;

                if (result.isEarlySeason) {
                    const earlyTranche = earlySeasonTrancheSummary[trancheKey];
                    earlyTranche.total++;
                    earlyTranche.predictionSum += prediction;
                    if (winStatus === 'WON') earlyTranche.success++;
                }
            }
        }
    }

    const calibrationReport = {};
    for (const market in perMarketSummary) {
        calibrationReport[market] = {};
        for (const key in perMarketSummary[market]) {
            const tranche = perMarketSummary[market][key];
            if (tranche.total > 0) {
                calibrationReport[market][key] = {
                    predicted: (tranche.predictionSum / tranche.total).toFixed(2),
                    actual: ((tranche.success / tranche.total) * 100).toFixed(2)
                };
            }
        }
    }

    const WHITELIST_SUCCESS_RATE = 0.85;
    const whitelist = {};
    for (const market in perMarketSummary) {
        for (const key in perMarketSummary[market]) {
            const tranche = perMarketSummary[market][key];
            if (tranche.total > 0 && (tranche.success / tranche.total) > WHITELIST_SUCCESS_RATE) {
                if (!whitelist[market]) whitelist[market] = [];
                whitelist[market].push(key);
            }
        }
    }

    const executionId = `backtest-run-${new Date().toISOString()}`;
    console.log(chalk.blue.bold(`Execution ID: ${executionId}`));

    const finalReport = { totalMatchesAnalyzed, perMarketSummary, whitelist, calibration: calibrationReport, earlySeasonSummary: earlySeasonTrancheSummary };
    const reportHtml = generateBacktestingHtml(finalReport);

    const runData = {
        summary: perMarketSummary,
        whitelist: whitelist,
        calibration: calibrationReport,
        earlySeasonSummary: earlySeasonTrancheSummary,
        totalMatchesAnalyzed: totalMatchesAnalyzed,
        reportHtml: reportHtml
    };

    await firestoreService.saveBacktestRun(executionId, runData);
    console.log(chalk.magenta.bold(`-> Backtest run ${executionId} sauvegardé.`));
    
    res.status(200).send(reportHtml);
});