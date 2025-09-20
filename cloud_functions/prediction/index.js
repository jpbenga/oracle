const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');
const { footballConfig } = require('./common/config/football.config');
const { gestionJourneeService } = require('./common/services/GestionJournee.service');
const { analyseMatchService } = require('./common/services/AnalyseMatch.service');
const { apiFootballService } = require('./common/services/ApiFootball.service');
const axios = require('axios');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getTrancheKey(score) {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    if (score >= 0) return "0-59";
    return null;
}

function getIntuitiveBestBet(scores, minConfidence = 60) {
    let bestBet = { market: 'N/A', score: 0 };
    let maxConfidence = 0;
    for (const market in scores) {
        const score = scores[market];
        if (score >= minConfidence) {
            const confidence = Math.abs(score - 50);
            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                bestBet = { market, score };
            }
        }
    }
    return bestBet;
}

function parseOdds(oddsData) {
    if (!oddsData || oddsData.length === 0) return {};
    const parsed = {};
    const fixtureOdds = oddsData[0];
    for (const bookmaker of fixtureOdds.bookmakers) {
        const bookmakerName = bookmaker.name;
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 1:
                    bet.values.forEach(v => {
                        const market = v.value.toLowerCase() + '_win';
                        if (!parsed[market]) parsed[market] = { odd: parseFloat(v.odd), bookmaker: bookmakerName };
                    });
                    const drawValue = bet.values.find(v => v.value === 'Draw');
                    if(drawValue && !parsed['draw']) parsed['draw'] = { odd: parseFloat(drawValue.odd), bookmaker: bookmakerName };
                    break;
                case 5: bet.values.forEach(v => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 8: bet.values.forEach(v => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 16: bet.values.forEach(v => { const k = `home_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 17: bet.values.forEach(v => { const k = `away_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 6: bet.values.forEach(v => { const k = `ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 26: bet.values.forEach(v => { const k = `st_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 105: bet.values.forEach(v => { const k = `home_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
                case 106: bet.values.forEach(v => { const k = `away_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = { odd: parseFloat(v.odd), bookmaker: bookmakerName }; }); break;
            }
        }
    }
    return parsed;
}

function generatePredictionHtml(predictionsByLeague, globalStatus) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        h1, h2 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; }
        .status { background-color: #1e1e1e; border: 1px solid #373737; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 1.1em; }
        .league-container { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; background-color: #1e1e1e; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #373737; }
        th { background-color: #2a2a2a; }
        .team-cell { display: flex; align-items: center; }
        .team-logo { width: 20px; height: 20px; margin-right: 10px; }
        .score { font-weight: bold; }
        .rate-high { color: #28a745; }
        .score-high { color: #03dac6; } .score-mid { color: #f0e68c; }
        .score-very-high { color: #00ff00; font-weight: bold; }
        .na { color: #666; }
    `;

    let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Prédictions des Matchs</title><style>${css}</style></head><body>
        <h1>Prédictions des Matchs à Venir</h1>
        <div class="status"><strong>Statut du cycle :</strong> ${globalStatus}</div>`;

    if (Object.keys(predictionsByLeague).length > 0) {
        for (const leagueName in predictionsByLeague) {
            html += `<div class="league-container"><h2><img src="${predictionsByLeague[leagueName][0].league.logo}" class="team-logo" alt=""> ${leagueName} (${predictionsByLeague[leagueName][0].league.country})</h2><table>
                        <thead><tr><th>Match</th><th>Meilleur Pari</th><th>Confiance</th><th>Cote</th><th>Bookmaker</th></tr></thead><tbody>`;
            predictionsByLeague[leagueName].forEach(match => {
                const bestBet = getIntuitiveBestBet(match.scores, 60);
                const scoreClass = bestBet.score >= 90 ? 'score-very-high' : bestBet.score >= 75 ? 'score-high' : 'score-mid';
                const bestBetOddInfo = match.odds[bestBet.market];
                
                html += `
                    <tr>
                        <td>
                            <div class="team-cell"><img src="${match.home_team.logo}" class="team-logo" alt=""> ${match.home_team.name}</div>
                            <div class="team-cell"><img src="${match.away_team.logo}" class="team-logo" alt=""> ${match.away_team.name}</div>
                            <small>${new Date(match.matchDate).toLocaleString('fr-FR')}</small>
                        </td>
                        <td>${bestBet.market}</td>
                        <td class="score ${scoreClass}">${Math.round(bestBet.score)}%</td>
                        <td>${bestBetOddInfo ? bestBetOddInfo.odd.toFixed(2) : '<span class="na">N/A</span>'}</td>
                        <td>${bestBetOddInfo ? bestBetOddInfo.bookmaker : '<span class="na">N/A</span>'}</td>
                    </tr>`;
            });
            html += `</tbody></table></div>`;
        }
    } else {
        html += `<p>Aucune prédiction éligible à afficher pour ce cycle.</p>`;
    }
    html += `</body></html>`;
    return html;
}

functions.http('prediction', async (req, res) => {
    console.log(chalk.blue.bold("---Démarrage du Job de Prédiction---"));
    
    const predictionRunId = `pred-run-${new Date().toISOString()}`;
    await firestoreService.savePredictionRun(predictionRunId, { status: 'Analyse en cours', createdAt: new Date() });

    const season = new Date().getFullYear();
    const eligiblePredictions = [];

    const latestRun = await firestoreService.getLatestBacktestRun();

    if (!latestRun || !latestRun.whitelist || !latestRun.summary) {
        const errorMsg = "ERREUR CRITIQUE: Aucune exécution de backtest valide n'a été trouvée.";
        await firestoreService.savePredictionRun(predictionRunId, { status: 'Erreur', message: errorMsg });
        const errorHtml = generatePredictionHtml({}, errorMsg);
        res.status(500).send(errorHtml);
        return;
    }

    const { whitelist, summary: backtestSummary, executionId } = latestRun;
    console.log(chalk.green(`Whitelist et résumé chargés depuis l'exécution: ${executionId}`));

    for (const league of footballConfig.leaguesToAnalyze) {
        console.log(chalk.cyan.bold(`\n[Prédiction] Analyse de la ligue : ${league.name}`));
        const upcomingMatches = await gestionJourneeService.getMatchesForPrediction(league.id, season);
        if (!upcomingMatches || upcomingMatches.length === 0) continue;

        for (const match of upcomingMatches) {
            console.log(chalk.green(`\n   Calcul pour : ${match.teams.home.name} vs ${match.teams.away.name}`));
            const analysisResult = await analyseMatchService.analyseMatch(match);
            if (analysisResult && analysisResult.markets) {
                const confidenceScores = analysisResult.markets;
                
                console.log(chalk.blue(`      -> Récupération des cotes pour le match ID: ${match.fixture.id}`));
                const oddsData = await apiFootballService.getOddsForFixture(match.fixture.id);
                const parsedOdds = parseOdds(oddsData || []);

                for (const market in confidenceScores) {
                    const score = confidenceScores[market];
                    if (typeof score === 'undefined') continue;
                    const trancheKey = getTrancheKey(score);
                    if (!trancheKey) continue;

                    if (whitelist[market] && whitelist[market].includes(trancheKey)) {
                        const oddInfo = parsedOdds[market];
                        const marketHistoricalPerformance = backtestSummary[market];

                        console.log(chalk.green.bold(`       -> Marché ${market} (score: ${score.toFixed(2)}%) VALIDÉ.`));
                        
                        const predictionData = {
                            predictionRunId: predictionRunId,
                            backtestExecutionId: executionId,
                            fixtureId: match.fixture.id,
                            home_team: {
                                name: match.teams.home.name,
                                logo: match.teams.home.logo
                            },
                            away_team: {
                                name: match.teams.away.name,
                                logo: match.teams.away.logo
                            },
                            league: {
                                name: match.league.name,
                                country: match.league.country,
                                logo: match.league.logo
                            },
                            matchDate: new Date(match.fixture.date).toISOString(),
                            match_status: 'Not Started',
                            market: market,
                            score: score,
                            odd: oddInfo ? oddInfo.odd : null,
                            bookmaker: oddInfo ? oddInfo.bookmaker : null,
                            market_performance: marketHistoricalPerformance || {},
                            status: oddInfo ? 'ELIGIBLE' : 'INCOMPLETE',
                        };
                        eligiblePredictions.push(predictionData);
                        await firestoreService.savePrediction(predictionData);
                    }
                }
                await sleep(500);
            }
        }
    }
    
    const finalStatus = `Analyse terminée. ${eligiblePredictions.length} prédictions éligibles trouvées.`;
    await firestoreService.savePredictionRun(predictionRunId, { status: finalStatus, finishedAt: new Date(), eligible_predictions_count: eligiblePredictions.length });

    const predictionsByLeague = {};
    for (const pred of eligiblePredictions) {
        const leagueName = pred.league.name;
        if (!predictionsByLeague[leagueName]) {
            predictionsByLeague[leagueName] = [];
        }
        
        let matchEntry = predictionsByLeague[leagueName].find(m => m.fixtureId === pred.fixtureId);
        if (!matchEntry) {
            matchEntry = {
                fixtureId: pred.fixtureId,
                home_team: pred.home_team,
                away_team: pred.away_team,
                league: pred.league,
                matchDate: pred.matchDate,
                scores: {},
                odds: {},
                market_performances: {}
            };
            predictionsByLeague[leagueName].push(matchEntry);
        }
        matchEntry.scores[pred.market] = pred.score;
        matchEntry.odds[pred.market] = { odd: pred.odd, bookmaker: pred.bookmaker };
        matchEntry.market_performances[pred.market] = pred.market_performance;
    }
    
    console.log(chalk.blue.bold(`\n--- ${finalStatus} ---`));
    const htmlResponse = generatePredictionHtml(Object.values(predictionsByLeague).length > 0 ? predictionsByLeague : {}, finalStatus);

    try {
        console.log(chalk.green("Déclenchement de la fonction de génération de tickets..."));
        const ticketGeneratorUrl = process.env.TICKET_FUNCTION_URL;
        if (ticketGeneratorUrl && ticketGeneratorUrl !== 'placeholder') {
            await axios.get(ticketGeneratorUrl, { timeout: 300000 });
        } else {
             console.log(chalk.yellow("URL du générateur de tickets non configurée."));
        }
        res.status(200).send(htmlResponse);
    } catch (error) {
        console.error(chalk.red("Erreur lors du déclenchement de la fonction de génération de tickets : "), error.message);
        res.status(500).send(htmlResponse);
    }
});