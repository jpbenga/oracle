const chalk = require('chalk');
const { apiFootballService } = require('./ApiFootball.service');

class AnalyseMatchService {
  constructor() {
    this.factorialCache = { 0: 1, 1: 1 };
  }

  factorial(n) {
    if (this.factorialCache[n] !== undefined) return this.factorialCache[n];
    if (n < 0) return 0;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    this.factorialCache[n] = result;
    return result;
  }

  poissonProbability(k, lambda) {
    if (lambda <= 0 || k < 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  bayesianSmooth(avg, matchesPlayed, prior = 1.35, priorStrength = 5) {
    if (matchesPlayed > 0 && matchesPlayed < 6) {
        return (avg * matchesPlayed + prior * priorStrength) / (matchesPlayed + priorStrength);
    }
    return avg;
  }

  calculateOverUnderProbs(lambda) {
    const probs = Array(7).fill(0).map((_, k) => this.poissonProbability(k, lambda));
    const cumulativeProbs = probs.reduce((acc, p, i) => {
      acc.push((acc[i - 1] || 0) + p);
      return acc;
    }, []);

    return {
      'over_0.5': (1 - (cumulativeProbs[0] || 0)) * 100,
      'under_0.5': (cumulativeProbs[0] || 0) * 100,
      'over_1.5': (1 - (cumulativeProbs[1] || 0)) * 100,
      'under_1.5': (cumulativeProbs[1] || 0) * 100,
      'over_2.5': (1 - (cumulativeProbs[2] || 0)) * 100,
      'under_2.5': (cumulativeProbs[2] || 0) * 100,
      'over_3.5': (1 - (cumulativeProbs[3] || 0)) * 100,
      'under_3.5': (cumulativeProbs[3] || 0) * 100,
    };
  }

  async analyseMatch(match, context) {
    const { teams, league } = match;
    const { standings, previousStandings } = context;

    const homeTeamId = teams.home.id;
    const awayTeamId = teams.away.id;

    // Extraire les statistiques du contexte (classement)
    const homeStats = standings.find(s => s.team.id === homeTeamId);
    const awayStats = standings.find(s => s.team.id === awayTeamId);

    if (!homeStats || !awayStats) {
        console.log(chalk.red(`      -> Manque de statistiques dans le classement pour le match ${teams.home.name} vs ${teams.away.name}.`));
        return null;
    }

    // L'API de classement fournit les stats différemment, nous devons adapter les noms
    // homeStats.goals.for.total -> homeStats.all.goals.for
    // homeStats.fixtures.played.total -> homeStats.all.played
    // On recalcule les moyennes car elles ne sont pas directes
    const homeMatchesPlayed = homeStats.all.played;
    const awayMatchesPlayed = awayStats.all.played;

    let homeAvgFor = homeMatchesPlayed > 0 ? homeStats.all.goals.for / homeMatchesPlayed : 0;
    let homeAvgAgainst = homeMatchesPlayed > 0 ? homeStats.all.goals.against / homeMatchesPlayed : 0;
    let awayAvgFor = awayMatchesPlayed > 0 ? awayStats.all.goals.for / awayMatchesPlayed : 0;
    let awayAvgAgainst = awayMatchesPlayed > 0 ? awayStats.all.goals.against / awayMatchesPlayed : 0;

    const matchesPlayed = homeMatchesPlayed; // Utiliser le nombre de matchs de l'équipe à domicile comme référence
    
    if (matchesPlayed > 0 && matchesPlayed < 6) {
        console.log(chalk.yellow(`      -> Début de saison détecté (${matchesPlayed} matchs). Application des corrections.`));
        
        const prevHomeStats = previousStandings.find(s => s.team.id === homeTeamId);
        const prevAwayStats = previousStandings.find(s => s.team.id === awayTeamId);

        let stabilityBoost = 1;
        if (prevHomeStats && prevAwayStats) {
            const prevHomeMatches = prevHomeStats.all.played;
            const prevAwayMatches = prevAwayStats.all.played;

            const prevHomeAvgFor = prevHomeMatches > 0 ? prevHomeStats.all.goals.for / prevHomeMatches : homeAvgFor;
            const prevHomeAvgAgainst = prevHomeMatches > 0 ? prevHomeStats.all.goals.against / prevHomeMatches : homeAvgAgainst;
            const prevAwayAvgFor = prevAwayMatches > 0 ? prevAwayStats.all.goals.for / prevAwayMatches : awayAvgFor;
            const prevAwayAvgAgainst = prevAwayMatches > 0 ? prevAwayStats.all.goals.against / prevAwayMatches : awayAvgAgainst;
            
            const homeStability = Math.abs(prevHomeAvgFor - homeAvgFor) < 0.5 ? 1.1 : 1;
            const awayStability = Math.abs(prevAwayAvgFor - awayAvgFor) < 0.5 ? 1.1 : 1;
            stabilityBoost = (homeStability + awayStability) / 2;

            homeAvgFor = (0.8 * prevHomeAvgFor) + (0.2 * homeAvgFor);
            homeAvgAgainst = (0.8 * prevHomeAvgAgainst) + (0.2 * homeAvgAgainst);
            awayAvgFor = (0.8 * prevAwayAvgFor) + (0.2 * awayAvgFor);
            awayAvgAgainst = (0.8 * prevAwayAvgAgainst) + (0.2 * awayAvgAgainst);
        }
        
        homeAvgFor = this.bayesianSmooth(homeAvgFor, matchesPlayed) * stabilityBoost;
        homeAvgAgainst = this.bayesianSmooth(homeAvgAgainst, matchesPlayed) * stabilityBoost;
        awayAvgFor = this.bayesianSmooth(awayAvgFor, matchesPlayed) * stabilityBoost;
        awayAvgAgainst = this.bayesianSmooth(awayAvgAgainst, matchesPlayed) * stabilityBoost;
    }

    const projectedHomeGoals = (homeAvgFor + awayAvgAgainst) / 2;
    const projectedAwayGoals = (awayAvgFor + homeAvgAgainst) / 2;
    
    const lambdaBoost = matchesPlayed >= 6 ? 1.1 : 1;
    const lambdas = {
        home: projectedHomeGoals * lambdaBoost,
        away: projectedAwayGoals * lambdaBoost,
        ht: ((projectedHomeGoals + projectedAwayGoals) * 0.45) * lambdaBoost,
        st: ((projectedHomeGoals + projectedAwayGoals) * 0.55) * lambdaBoost,
        home_ht: (projectedHomeGoals * 0.45) * lambdaBoost,
        home_st: (projectedHomeGoals * 0.55) * lambdaBoost,
        away_ht: (projectedAwayGoals * 0.45) * lambdaBoost,
        away_st: (projectedAwayGoals * 0.55) * lambdaBoost
    };

    // Le format des stats du classement est différent de celui de /teams/statistics
    // Nous devons passer un objet compatible à la fonction predict
    const compatibleHomeStats = { form: homeStats.form };
    const compatibleAwayStats = { form: awayStats.form };

    return this.predict(lambdas, compatibleHomeStats, compatibleAwayStats, projectedHomeGoals, projectedAwayGoals);
  }

  predict(lambdas, homeStats, awayStats, projectedHomeGoals, projectedAwayGoals) {
    const { home, away, ht, st, home_ht, home_st, away_ht, away_st } = lambdas;
    const markets = {};

    const segments = { home, away, ht, st, home_ht, home_st, away_ht, away_st };
    for (const prefix in segments) {
      const lambda = segments[prefix];
      const segmentProbs = this.calculateOverUnderProbs(lambda);
      for (const key in segmentProbs) {
        markets[`${prefix}_${key}`] = segmentProbs[key];
      }
    }

    const maxGoals = 8;
    const scoreProbabilities = Array(maxGoals + 1).fill(0).map(() => Array(maxGoals + 1).fill(0));
    let homeWinProb = 0, awayWinProb = 0, drawProb = 0;

    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        const prob = this.poissonProbability(i, home) * this.poissonProbability(j, away);
        scoreProbabilities[i][j] = prob;
        if (i > j) homeWinProb += prob;
        else if (j > i) awayWinProb += prob;
        else drawProb += prob;
      }
    }
    
    const homeFormPoints = (homeStats.form?.match(/W/g) || []).length * 3 + (homeStats.form?.match(/D/g) || []).length;
    const awayFormPoints = (awayStats.form?.match(/W/g) || []).length * 3 + (awayStats.form?.match(/D/g) || []).length;
    const formFactor = (homeFormPoints - awayFormPoints) / 15;
    const goalDisparity = Math.abs(projectedHomeGoals - projectedAwayGoals);
    const disparityBoost = goalDisparity > 0.5 ? 1 + (goalDisparity - 0.5) * 0.2 : 1;
    
    homeWinProb *= (1 + formFactor * 0.3) * disparityBoost;
    awayWinProb *= (1 - formFactor * 0.3) * disparityBoost;

    const totalProb = homeWinProb + awayWinProb + drawProb;
    if (totalProb > 0) {
      markets['home_win'] = (homeWinProb / totalProb) * 100;
      markets['away_win'] = (awayWinProb / totalProb) * 100;
      markets['draw'] = (drawProb / totalProb) * 100;
    }

    markets['favorite_win'] = Math.max(markets['home_win'] || 0, markets['away_win'] || 0);
    markets['outsider_win'] = Math.min(markets['home_win'] || 0, markets['away_win'] || 0);
    markets['double_chance_favorite'] = (markets['favorite_win'] || 0) + (markets['draw'] || 0);
    markets['double_chance_outsider'] = (markets['outsider_win'] || 0) + (markets['draw'] || 0);

    let probBttsNo = scoreProbabilities[0][0];
    for (let i = 1; i <= maxGoals; i++) {
        probBttsNo += scoreProbabilities[i][0] + scoreProbabilities[0][i];
    }

    markets['btts'] = (1 - probBttsNo) * 100;
    markets['btts_no'] = probBttsNo * 100;

    const matchProbs = this.calculateOverUnderProbs(home + away);
    for (const key in matchProbs) {
      markets[`match_${key}`] = matchProbs[key];
    }

    if (markets['draw']) markets['draw'] *= 1.2;
    if (markets['favorite_win']) markets['favorite_win'] *= 1.2;
    if (markets['outsider_win']) markets['outsider_win'] *= 1.2;

    return { markets };
  }
}

exports.analyseMatchService = new AnalyseMatchService();
