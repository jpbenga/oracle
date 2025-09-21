const chalk = require('chalk');
const { apiFootballService } = require('./ApiFootball.service');

class GestionJourneeService {

    async getMatchesForBacktesting(leagueId, season) {
        const rounds = await apiFootballService.getRounds(leagueId, season);
        if (!rounds || rounds.length === 0) {
            console.log(chalk.gray(`      -> Aucune journée trouvée.`));
            return null;
        }

        const currentRoundName = rounds.find(r => r.includes("Regular Season")); // Prioritize finding the current round
        if (!currentRoundName) {
            console.log(chalk.gray(`      -> Nom de journée valide non trouvé.`));
            return null;
        }
        
        const roundParts = currentRoundName.match(/(\D+)(\d+)/);
        if (!roundParts || !roundParts[2] || parseInt(roundParts[2], 10) <= 1) {
            console.log(chalk.gray(`      -> Pas de journée N-1 à analyser.`));
            return null;
        }
        
        const prefix = roundParts[1]?.trim();
        const previousRoundNumber = parseInt(roundParts[2], 10) - 1;
        const previousRoundName = `${prefix} - ${previousRoundNumber}`;
        
        console.log(chalk.green(`      -> Journée N-1 identifiée : "${previousRoundName}"`));

        const fixtures = await apiFootballService.getFixturesByRound(leagueId, season, previousRoundName);

        if (!fixtures) {
            console.log(chalk.red(`      -> Impossible de récupérer les matchs pour la journée ${previousRoundName}.`));
            return null;
        }

        const finishedMatches = fixtures.filter((f) => f.fixture.status.short === 'FT');
        console.log(chalk.green(`      -> ${finishedMatches.length} match(s) terminé(s) trouvé(s).`));

        return finishedMatches;
    }

    async getMatchesForPrediction(leagueId, season) {
        // 1. Identifier la journée en cours
        const rounds = await apiFootballService.getRounds(leagueId, season);
        if (!rounds || rounds.length === 0) {
            console.log(chalk.yellow(`      -> Aucune journée en cours trouvée pour la ligue ${leagueId}.`));
            return null;
        }

        const currentRoundName = rounds.find(r => r.includes("Regular Season"));
        if (!currentRoundName) {
            console.log(chalk.yellow(`      -> Nom de la journée en cours non identifié.`));
            return null;
        }
        console.log(chalk.green(`      -> Journée actuelle identifiée : "${currentRoundName}"`));

        // 2. Récupérer les matchs de cette journée
        const fixtures = await apiFootballService.getFixturesByRound(leagueId, season, currentRoundName);
        if (!fixtures || fixtures.length === 0) {
            console.log(chalk.yellow(`      -> Aucun match trouvé pour la journée "${currentRoundName}".`));
            return null;
        }
        console.log(chalk.green(`      -> ${fixtures.length} match(s) trouvé(s) pour la journée.`));

        // 3. Récupérer les classements (actuel et précédent)
        const [standingsResponse, previousStandingsResponse] = await Promise.all([
            apiFootballService.getStandings(leagueId, season),
            apiFootballService.getStandings(leagueId, season - 1)
        ]);

        if (!standingsResponse || !standingsResponse[0] || !standingsResponse[0].league || !standingsResponse[0].league.standings) {
            console.log(chalk.red(`      -> Impossible de récupérer le classement pour la ligue ${leagueId}.`));
            return null;
        }
        const standings = standingsResponse[0].league.standings[0];
        console.log(chalk.green(`      -> Classement actuel récupéré.`));

        const previousStandings = (previousStandingsResponse && previousStandingsResponse[0] && previousStandingsResponse[0].league && previousStandingsResponse[0].league.standings) 
            ? previousStandingsResponse[0].league.standings[0] 
            : [];
        console.log(chalk.green(`      -> Classement N-1 récupéré.`));

        // 4. Retourner le paquet complet
        return {
            round: currentRoundName,
            fixtures: fixtures,
            standings: standings,
            previousStandings: previousStandings
        };
    }
}

exports.gestionJourneeService = new GestionJourneeService();
