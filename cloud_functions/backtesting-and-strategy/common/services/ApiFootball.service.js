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
    this.countriesCache = null;
  }

  async getCountries() {
    if (this.countriesCache) {
      return this.countriesCache;
    }

    const countries = await this.makeRequest('/countries');
    if (!countries) {
      return null;
    }

    this.countriesCache = new Map(countries.map(c => [c.name, c.code]));
    return this.countriesCache;
  }

  async makeRequest(endpoint, params) {
    console.log('      -> Paramètres de la requête:', JSON.stringify(params, null, 2));
    let attempts = 0;
    while (attempts < footballConfig.maxApiAttempts) {
      attempts++;
      try {
        const response = await this.api.get(endpoint, { params });
        if (response.data && Array.isArray(response.data.response) && response.data.response.length === 0) {
            console.log(chalk.yellow(`      -> Tentative API ${attempts}/${footballConfig.maxApiAttempts} (${endpoint}) : L'API a retourné une réponse vide (0 éléments).`));
            if (attempts < footballConfig.maxApiAttempts) await sleep(1500);
            continue;
        }
        if (response.data && response.data.response) {
          return response.data.response;
        }
      } catch (error) {
        console.log(chalk.red(`      -> Tentative API ${attempts}/${footballConfig.maxApiAttempts} (${endpoint}) échouée.`));
        if (axios.isAxiosError(error) && error.response) {
          console.log(chalk.red(`      -> Code d'erreur API: ${error.response.status}`));
          console.log(chalk.red('      -> Réponse API:', JSON.stringify(error.response.data, null, 2)));
        } else {
          console.log(chalk.red('      -> Erreur détaillée:', error.message));
        }
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
}

exports.apiFootballService = new ApiFootballService();