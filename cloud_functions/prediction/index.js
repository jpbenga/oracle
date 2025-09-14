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
        const matchWinnerBet = bookmaker.bets.find(b => b.id === 1);
        const doubleChanceBet = bookmaker.bets.find(b => b.id === 12);
        if (matchWinnerBet) {
            const homeOdd = parseFloat(matchWinnerBet.values.find(v => v.value === 'Home')?.odd);
            const drawOdd = parseFloat(matchWinnerBet.values.find(v => v.value === 'Draw')?.odd);
            const awayOdd = parseFloat(matchWinnerBet.values.find(v => v.value === 'Away')?.odd);
            if (homeOdd && drawOdd && awayOdd) {
                if (!parsed['draw']) parsed['draw'] = drawOdd;
                const isHomeFavorite = homeOdd < awayOdd;
                if (!parsed['favorite_win']) parsed['favorite_win'] = isHomeFavorite ? homeOdd : awayOdd;
                if (!parsed['outsider_win']) parsed['outsider_win'] = isHomeFavorite ? awayOdd : homeOdd;
                if (doubleChanceBet) {
                    const homeDrawOdd = parseFloat(doubleChanceBet.values.find(v => v.value === 'Home/Draw')?.odd);
                    const awayDrawOdd = parseFloat(doubleChanceBet.values.find(v => v.value === 'Draw/Away')?.odd);
                    if (homeDrawOdd && awayDrawOdd) {
                        if (!parsed['double_chance_favorite']) parsed['double_chance_favorite'] = isHomeFavorite ? homeDrawOdd : awayDrawOdd;
                        if (!parsed['double_chance_outsider']) parsed['double_chance_outsider'] = isHomeFavorite ? awayDrawOdd : homeDrawOdd;
                    }
                }
            }
        }
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 5: bet.values.forEach(v => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 8: bet.values.forEach(v => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 16: bet.values.forEach(v => { const k = `home_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 17: bet.values.forEach(v => { const k = `away_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 6: bet.values.forEach(v => { const k = `ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 26: bet.values.forEach(v => { const k = `st_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 105: bet.values.forEach(v => { const k = `home_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 106: bet.values.forEach(v => { const k = `away_ht_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
            }
        }
    }
    return parsed;
}

function generatePredictionHtml(predictionsByLeague, status) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        h1, h2 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; }
        .status { background-color: #1e1e1e; border: 1px solid #373737; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 1.1em; }
        .league-container { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; background-color: #1e1e1e; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #373737; }
        th { background-color: #2a2a2a; }
        details { background-color: #1e1e1e; }
        summary { cursor: pointer; padding: 8px 15px; background-color: #1e1e1e; font-style: italic; color: #aaa; border-bottom: 1px solid #373737;}
        summary:hover { background-color: #2a2a2a; }
        .details-table { margin: 0; border-radius: 0; box-shadow: none; }
        .score { font-weight: bold; }
        .score-high { color: #03dac6; } .score-mid { color: #f0e68c; }
        .score-very-high { color: #00ff00; font-weight: bold; }
        .na { color: #666; }
    `;

    let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Prédictions des Matchs</title><style>${css}</style></head><body>
        <h1>Prédictions des Matchs à Venir</h1>
        <div class="status"><strong>Statut :</strong> ${status}</div>`;

    if (Object.keys(predictionsByLeague).length > 0) {
        for (const leagueName in predictionsByLeague) {
            html += `<div class="league-container"><h2>${leagueName}</h2><table>
                        <thead><tr><th>Match</th><th>Date</th><th>Heure</th><th>Marché le + Fiable</th></tr></thead><tbody>`;
            predictionsByLeague[leagueName].forEach(match => {
                const bestBet = getIntuitiveBestBet(match.scores, 60);
                const scoreClass = bestBet.score >= 90 ? 'score-very-high' : bestBet.score >= 75 ? 'score-high' : 'score-mid';
                const bestBetOdd = match.odds[bestBet.market];
                html += `
                    <tr>
                        <td>${match.matchLabel}</td>
                        <td>${match.date}</td>
                        <td>${match.time}</td>
                        <td>${bestBet.market} <span class="score ${scoreClass}">(${Math.round(bestBet.score)}%)</span> @ ${bestBetOdd ? bestBetOdd.toFixed(2) : '<span class="na">N/A</span>'}</td>
                    </tr>
                    <tr><td colspan="4" style="padding:0;">
                        <details>
                            <summary>Voir tous les marchés éligibles</summary>
                            <table class="details-table">
                                <thead><tr><th>Marché</th><th>Score de Confiance</th><th>Cote</th></tr></thead>
                                <tbody>`;
                Object.keys(match.scores).sort().forEach(market => {
                    const score = match.scores[market];
                    const odd = match.odds[market];
                    const sClass = score >= 90 ? 'score-very-high' : score >= 75 ? 'score-high' : 'score-mid';
                    html += `<tr>
                                <td>${market}</td>
                                <td class="score ${sClass}">${Math.round(score)}%</td>
                                <td>${odd ? odd.toFixed(2) : '<span class="na">N/A</span>'}</td>
                            </tr>`;
                });
                html += `</tbody></table></details></td></tr>`;
            });
            html += `</tbody></table></div>`;
        }
    } else {
        html += `<p>Aucune prédiction éligible à afficher.</p>`;
    }
    html += `</body></html>`;
    return html;
}


functions.http('runPrediction', async (req, res) => {
    console.log(chalk.blue.bold("---" + "Démarrage du Job de Prédiction" + "---"));
    
    const season = new Date().getFullYear();
    const eligiblePredictions = [];

    const whitelist = await firestoreService.getWhitelist();
    if (!whitelist) {
        const errorHtml = generatePredictionHtml({}, "ERREUR CRITIQUE: Whitelist non trouvée. Le backtesting doit être exécuté d'abord.");
        res.status(500).send(errorHtml);
        return;
    }
    console.log(chalk.green("Whitelist chargée avec succès. Application de la stratégie de filtrage."));

    for (const league of footballConfig.leaguesToAnalyze) {
        console.log(chalk.cyan.bold(`
[Prédiction] Analyse de la ligue : ${league.name}`));
        const upcomingMatches = await gestionJourneeService.getMatchesForPrediction(league.id, season);
        if (!upcomingMatches || upcomingMatches.length === 0) {
            console.log(chalk.yellow(`Aucun match à venir trouvé pour la ligue ${league.name}.`));
            continue;
        }

        for (const match of upcomingMatches) {
            console.log(chalk.green(`
   Calcul pour : ${match.teams.home.name} vs ${match.teams.away.name}`));
            const analysisResult = await analyseMatchService.analyseMatch(match);
            if (analysisResult && analysisResult.markets) {
                const confidenceScores = analysisResult.markets;
                
                console.log(chalk.blue(`      -> Récupération des cotes pour le match ID: ${match.fixture.id}`));
                const oddsData = await apiFootballService.getOddsForFixture(match.fixture.id);
                console.log(`      -> Cotes reçues de l'API: ${oddsData && oddsData.length > 0 ? `${oddsData[0].bookmakers.length} bookmakers` : 'Aucune'}`);

                const parsedOdds = parseOdds(oddsData || []);
                console.log(`      -> Cotes interprétées: ${Object.keys(parsedOdds).length} cotes trouvées.`);

                for (const market in confidenceScores) {
                    const score = confidenceScores[market];
                    if (typeof score === 'undefined') continue;
                    const trancheKey = getTrancheKey(score);
                    if (!trancheKey) continue;

                    if (whitelist[market] && whitelist[market].includes(trancheKey)) {
                        const odd = parsedOdds[market];
                        console.log(chalk.green.bold(`       -> Marché ${market} (score: ${score.toFixed(2)}%) VALIDÉ. Recherche de cote... ${odd ? `Trouvée: ${odd}`: 'Non trouvée'}`));
                        
                        const predictionData = {
                            fixtureId: match.fixture.id,
                            matchLabel: `${match.teams.home.name} vs ${match.teams.away.name}`,
                            matchDate: new Date(match.fixture.date).toISOString(),
                            leagueId: league.id,
                            leagueName: league.name,
                            market: market,
                            score: score,
                            odd: odd || null,
                            status: odd ? 'ELIGIBLE' : 'INCOMPLETE',
                        };
                        eligiblePredictions.push(predictionData);
                        await firestoreService.savePrediction(predictionData);
                    }
                }
                await sleep(500);
            }
        }
    }
    
    const predictionsByLeague = {};
    for (const pred of eligiblePredictions) {
        if (!predictionsByLeague[pred.leagueName]) {
            predictionsByLeague[pred.leagueName] = {};
        }
        if (!predictionsByLeague[pred.leagueName][pred.fixtureId]) {
            const matchDate = new Date(pred.matchDate);
            predictionsByLeague[pred.leagueName][pred.fixtureId] = {
                matchLabel: pred.matchLabel,
                date: matchDate.toLocaleDateString('fr-FR'),
                time: matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                scores: {},
                odds: {}
            };
        }
        predictionsByLeague[pred.leagueName][pred.fixtureId].scores[pred.market] = pred.score;
        predictionsByLeague[pred.leagueName][pred.fixtureId].odds[pred.market] = pred.odd;
    }

    const finalPredictions = Object.keys(predictionsByLeague).reduce((acc, leagueName) => {
        acc[leagueName] = Object.values(predictionsByLeague[leagueName]);
        return acc;
    }, {});

    const status = `Prédictions prêtes. ${eligiblePredictions.length} marchés éligibles trouvés.`;
    console.log(chalk.blue.bold(`
--- ${status} ---`));
    const htmlResponse = generatePredictionHtml(finalPredictions, status);

    try {
        console.log(chalk.green("Déclenchement de la fonction de génération de tickets..."));
        const ticketGeneratorUrl = process.env.TICKET_FUNCTION_URL;
        if (ticketGeneratorUrl && ticketGeneratorUrl !== 'placeholder') {
            await axios.get(ticketGeneratorUrl, { timeout: 300000 });
        } else {
             console.log(chalk.yellow("URL du générateur de tickets non configurée. Arrêt de la chaîne."));
        }
        res.status(200).send(htmlResponse);
    } catch (error) {
        console.error(chalk.red("Erreur lors du déclenchement de la fonction de génération de tickets : "), error.message);
        res.status(500).send(htmlResponse); // Send report even if trigger fails
    }
});
