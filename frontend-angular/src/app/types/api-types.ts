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
  id: string;
  league: string;
  matchLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  date: string;
  time: string;
  market: string;
  score: number;
  odd: number;
  isEarlySeason: boolean;
  expectedValue: number;
  result?: 'Win' | 'Loss' | 'Pending';
}

export interface Ticket {
  id: string;
  date: string;
  bets: Bet[];
  totalOdd: number;
  title: "The Oracle's Choice" | "The Agent's Play" | "The Red Pill";
  status: 'won' | 'lost' | 'pending';
}

// La réponse de l'API pour les tickets est un objet avec les dates comme clés,
// puis les titres comme sous-clés.
export interface TicketsApiResponse {
  [date: string]: {
    "The Oracle's Choice"?: Ticket[];
    "The Agent's Play"?: Ticket[];
    "The Red Pill"?: Ticket[];
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
