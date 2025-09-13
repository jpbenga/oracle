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

function parseOdds(oddsData) {
    if (!oddsData || oddsData.length === 0) return {};
    const parsed = {};
    const fixtureOdds = oddsData[0];
    for (const bookmaker of fixtureOdds.bookmakers) {
        const matchWinnerBet = bookmaker.bets.find((b) => b.id === 1);
        const doubleChanceBet = bookmaker.bets.find((b) => b.id === 12);
        if (matchWinnerBet) {
            const homeOdd = parseFloat(matchWinnerBet.values.find((v) => v.value === 'Home')?.odd);
            const drawOdd = parseFloat(matchWinnerBet.values.find((v) => v.value === 'Draw')?.odd);
            const awayOdd = parseFloat(matchWinnerBet.values.find((v) => v.value === 'Away')?.odd);
            if (homeOdd && drawOdd && awayOdd) {
                if (!parsed['draw']) parsed['draw'] = drawOdd;
                const isHomeFavorite = homeOdd < awayOdd;
                if (!parsed['favorite_win']) parsed['favorite_win'] = isHomeFavorite ? homeOdd : awayOdd;
                if (!parsed['outsider_win']) parsed['outsider_win'] = isHomeFavorite ? awayOdd : homeOdd;
                if (doubleChanceBet) {
                    const homeDrawOdd = parseFloat(doubleChanceBet.values.find((v) => v.value === 'Home/Draw')?.odd);
                    const awayDrawOdd = parseFloat(doubleChanceBet.values.find((v) => v.value === 'Draw/Away')?.odd);
                    if (homeDrawOdd && awayDrawOdd) {
                        if (!parsed['double_chance_favorite']) parsed['double_chance_favorite'] = isHomeFavorite ? homeDrawOdd : awayDrawOdd;
                        if (!parsed['double_chance_outsider']) parsed['double_chance_outsider'] = isHomeFavorite ? awayDrawOdd : homeDrawOdd;
                    }
                }
            }
        }
        for (const bet of bookmaker.bets) {
            switch (bet.id) {
                case 5: bet.values.forEach((v) => { const k = `match_${v.value.toLowerCase().replace(' ', '_')}`; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
                case 8: bet.values.forEach((v) => { const k = v.value === 'Yes' ? 'btts' : 'btts_no'; if (!parsed[k]) parsed[k] = parseFloat(v.odd); }); break;
            }
        }
    }
    return parsed;
}


functions.http('runPrediction', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Prédiction ---"));
    
    const season = new Date().getFullYear();
    let totalPredictionsSaved = 0;

    const whitelist = await firestoreService.getWhitelist();
    if (!whitelist) {
        console.error(chalk.red("ERREUR CRITIQUE: Whitelist non trouvée. Le backtesting doit être exécuté d'abord."));
        res.status(500).send("Whitelist non trouvée.");
        return;
    }
    console.log(chalk.green("Whitelist chargée avec succès. Application de la stratégie de filtrage."));

    for (const league of footballConfig.leaguesToAnalyze) {
        console.log(chalk.cyan.bold(`\n[Prédiction] Analyse de la ligue : ${league.name}`));

        const upcomingMatches = await gestionJourneeService.getMatchesForPrediction(league.id, season);
        
        if (!upcomingMatches || upcomingMatches.length === 0) {
            console.log(chalk.yellow(`Aucun match à venir trouvé pour la ligue ${league.name}.`));
            continue;
        }

        for (const match of upcomingMatches) {
            console.log(chalk.green(`\n   Calcul pour : ${match.teams.home.name} vs ${match.teams.away.name}`));

            const analysisResult = await analyseMatchService.analyseMatch(match);

            if (analysisResult && analysisResult.markets) {
                const confidenceScores = analysisResult.markets;
                const oddsData = await apiFootballService.getOddsForFixture(match.fixture.id);
                const parsedOdds = parseOdds(oddsData || []);
                
                let savedCount = 0;
                for (const market in confidenceScores) {
                    const score = confidenceScores[market];
                    if (typeof score === 'undefined') continue;

                    const trancheKey = getTrancheKey(score);
                    if (!trancheKey) continue;

                    const isWhitelisted = whitelist[market] && whitelist[market].includes(trancheKey);

                    if (!isWhitelisted) {
                        console.log(chalk.gray(`       -> Marché ${market} (score: ${score.toFixed(2)}%, tranche: ${trancheKey}) filtré car non présent dans la whitelist.`));
                        continue;
                    }
                     console.log(chalk.green.bold(`       -> Marché ${market} (score: ${score.toFixed(2)}%) VALIDÉ par la whitelist.`));

                    const odd = parsedOdds[market];
                    const status = odd ? 'ELIGIBLE' : 'INCOMPLETE';

                    const predictionData = {
                        fixtureId: match.fixture.id,
                        matchLabel: `${match.teams.home.name} vs ${match.teams.away.name}`,
                        matchDate: new Date(match.fixture.date).toISOString(),
                        leagueId: league.id,
                        leagueName: league.name,
                        market: market,
                        score: score,
                        odd: odd || null,
                        status: status,
                        createdAt: new Date().toISOString()
                    };

                    await firestoreService.savePrediction(predictionData);
                    savedCount++;
                }
                
                if (savedCount > 0) {
                    totalPredictionsSaved += savedCount;
                }
                await sleep(500);
            }
        }
    }
    
    console.log(chalk.blue.bold(`\n--- Total de ${totalPredictionsSaved} prédictions sauvegardées ---`));
    
    try {
        console.log(chalk.green("Déclenchement de la fonction de génération de tickets..."));
        const ticketGeneratorUrl = process.env.TICKET_FUNCTION_URL;
        if (ticketGeneratorUrl && ticketGeneratorUrl !== 'placeholder') {
            await axios.get(ticketGeneratorUrl, { timeout: 300000 });
            res.status(200).send("Prédiction terminée, génération de tickets déclenchée.");
        } else {
             console.log(chalk.yellow("URL du générateur de tickets non configurée. Arrêt de la chaîne."));
             res.status(200).send("Prédiction terminée, URL du générateur de tickets non configurée.");
        }
    } catch (error) {
        console.error(chalk.red("Erreur lors du déclenchement de la fonction de génération de tickets :"), error.message);
        res.status(500).send("Erreur lors du déclenchement de la fonction suivante.");
    }
});