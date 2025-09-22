// Structures basées sur les données générées par les scripts Node.js

// --- Prédictions (de predictions_du_jour.json) ---

export interface Prediction {
  matchLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  date: string; // Format "dd/MM/yyyy"
  time: string; // Format "HH:mm"
  scores: { [market: string]: number };
  odds: { [market: string]: number };
  isEarlySeason: boolean;
  leagueName: string; // Ajout pour savoir à quelle ligue le match appartient
  status?: 'PENDING' | 'ELIGIBLE' | 'INCOMPLETE' | 'COMPLETED'; // Statut de la prédiction
  result?: any; // Peut contenir les scores finaux, etc.
}

// La réponse de l'API pour les prédictions est un objet avec les noms de ligue comme clés.
export interface PredictionsApiResponse {
  [leagueName: string]: Prediction[];
}


// --- Tickets (de tickets_du_jour.json) ---

export interface Bet {
  fixtureId: number;
  matchLabel: string;
  home_team: { name: string; logo: string; };
  away_team: { name: string; logo: string; };
  league: { name: string; country: string; logo: string; };
  matchDate: string; // ISOString
  market: string;
  score: number;
  odd: number | null;
  bookmaker: string | null;
  market_performance: { [tranche: string]: { success: number; total: number; } };
  status: string;
  result: string | null;
}

export interface Ticket {
  title: string;
  totalOdd: number;
  date: string; // YYYY-MM-DD
  status: string;
  bets: Bet[];
}

// La réponse de l'API pour les tickets est un objet avec les dates comme clés,
// puis les titres comme sous-clés.
export interface TicketsApiResponse {
  [date: string]: {
    [title: string]: Ticket[];
  };
}

// --- Objet simplifié pour l'affichage dans les composants ---

export interface DisplayPrediction {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  time: string;
  prediction: string;
  predictionMarket: string; // Le marché de la meilleure prédiction
  predictionValue?: 'Home' | 'Away' | 'Draw' | 'Yes' | 'No' | string; // e.g., Over 2.5, Yes (for BTTS)
  confidence: number;
  odd?: number;
  result?: boolean;
}
