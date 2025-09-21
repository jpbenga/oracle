const axios = require('axios');
const chalk = require('chalk');
const { footballConfig } = require('../config/football.config');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ApiFootballService {
  constructor() {
    this.api = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: {
        'x-rapidapi-host': footballConfig.apiHost,
        'x-rapidapi-key': footballConfig.apiKey,
      },
      timeout: 20000,
    });
  }

  async makeRequest(endpoint, params) {
    let attempts = 0;
    while (attempts < footballConfig.maxApiAttempts) {
      attempts++;
      try {
        const response = await this.api.get(endpoint, { params });
        if (response.data && Array.isArray(response.data.response) && response.data.response.length === 0) {
            console.log(chalk.yellow(`      -> Tentative API ${attempts}/${footballConfig.maxApiAttempts} (${endpoint}) échouée. Raison: L'API a répondu OK mais n'a retourné aucune donnée pour ces paramètres.`));
            if (attempts < footballConfig.maxApiAttempts) await sleep(1500);
            continue;
        }
        if (response.data && response.data.response) {
          return response.data.response;
        }
      } catch (error) {
        let errorMessage = 'Erreur inconnue';
        if (axios.isAxiosError(error)) {
          if (error.response) {
            errorMessage = `Statut ${error.response.status} - Réponse API: ${JSON.stringify(error.response.data, null, 2)}`;
          } else if (error.request) {
            errorMessage = "Aucune réponse reçue de l'API (timeout probable)";
          } else {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
        console.log(chalk.yellow(`      -> Tentative API ${attempts}/${footballConfig.maxApiAttempts} (${endpoint}) échouée. Raison: ${errorMessage}`));
      }
      if (attempts < footballConfig.maxApiAttempts) await sleep(1500);
    }
    console.log(chalk.red(`      -> ERREUR FINALE: Impossible de récupérer les données pour ${endpoint} après ${footballConfig.maxApiAttempts} tentatives.`));
    return null;
  }

  async getTeamStats(teamId, leagueId, season) {
    return this.makeRequest('/teams/statistics', { team: teamId, league: leagueId, season });
  }

  async getOddsForFixture(fixtureId) {
    return this.makeRequest('/odds', { fixture: fixtureId });
  }

  async getRounds(leagueId, season) {
    return this.makeRequest('/fixtures/rounds', { league: leagueId, season, current: 'true' });
  }
    
  async getFixturesByRound(leagueId, season, round) {
    return this.makeRequest('/fixtures', { league: leagueId, season, round });
  }

  async getMatchesByDateRange(fromDate, toDate, leagueId, season) {
    return this.makeRequest('/fixtures', { from: fromDate, to: toDate, league: leagueId, season: season });
  }

  async getMatchById(matchId) {
    const results = await this.makeRequest('/fixtures', { id: matchId });
    return results && results.length > 0 ? results[0] : null;
  }

  async getFixturesByIds(ids) {
    if (!ids || ids.length === 0) return [];

    const batchSize = 20; // Batch size for API requests
    const batches = [];
    for (let i = 0; i < ids.length; i += batchSize) {
        batches.push(ids.slice(i, i + batchSize));
    }

    console.log(chalk.yellow(`      -> Récupération de ${ids.length} match(s) en ${batches.length} lot(s) via l'API.`));

    const allFixtures = [];
    for (const batch of batches) {
        const idsString = batch.join('-');
        const fixtures = await this.makeRequest('/fixtures', { ids: idsString });
        if (fixtures) {
            allFixtures.push(...fixtures);
        }
        await sleep(1000); // Sleep between batches to be nice to the API
    }
    
    return allFixtures;
  }
}

exports.apiFootballService = new ApiFootballService();