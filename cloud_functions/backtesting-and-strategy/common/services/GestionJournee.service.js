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
        
        const roundParts = currentRoundName.match(/(.*?)\s*-\s*(\d+)/);
        if (!roundParts || !roundParts[2] || parseInt(roundParts[2], 10) <= 1) {
            console.log(chalk.gray(`      -> Pas de journée N-1 à analyser.`));
            return null;
        }
        
        const prefix = roundParts[1];
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
        const rounds = await apiFootballService.getRounds(leagueId, season);
        if (!rounds || rounds.length === 0) return [];

        const currentRoundName = rounds.find(r => r.includes("Regular Season"));
        if (!currentRoundName) {
            console.log(chalk.gray(`      -> Nom de journée valide non trouvé.`));
            return [];
        }
        console.log(chalk.green(`      -> Journée actuelle identifiée : "${currentRoundName}"`));

        const fixtures = await apiFootballService.getFixturesByRound(leagueId, season, currentRoundName);
        if (!fixtures) return [];
        
        const upcomingMatches = fixtures.filter((f) => f.fixture.status.short === 'NS');
        console.log(chalk.green(`      -> ${upcomingMatches.length} match(s) à venir trouvé(s).`));
        
        return upcomingMatches;
    }
}

exports.gestionJourneeService = new GestionJourneeService();