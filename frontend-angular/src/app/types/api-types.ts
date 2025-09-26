
// --- Modèles de données principaux ---

export interface Prediction {
  id: string;
  fixtureId: number;
  matchLabel: string;
  home_team?: { name: string; logo: string; };
  away_team?: { name: string; logo: string; };
  league?: { name: string; country: string; logo: string; };
  matchDate: string; // ISOString
  market: string;
  score: number;
  odd: number | null;
  bookmaker: string | null;
  market_performance: { [tranche: string]: { success: number; total: number; } };
  status: string;
  result: string | null;
  backtestExecutionId: string;
}

export interface Ticket {
  title: string;
  totalOdd: number;
  date: string; // YYYY-MM-DD
  status: string;
  bets: Prediction[];
}

export interface PredictionReport {
  executionId: string;
  status: 'PROCESSING' | 'COMPLETED';
  summary: { total: number; won: number; lost: number; pending: number; };
}

export interface PredictionResult {
    predictionId: string;
    result: 'WON' | 'LOST';
}

export interface Character {
  name: string;
  goal: number;
  bankroll: number;
  initialBankroll: number;
  progress: number; // Represents wins
  losses: number;
  performance: number;
}


// --- Réponses des services ---

export interface TicketsApiResponse {
  [date: string]: {
    [title: string]: Ticket[];
  };
}

export interface ShortlistResponse {
  report: PredictionReport | null;
  predictions: (Prediction & { resultStatus?: 'WON' | 'LOST' | 'UNKNOWN' | 'IN_PROGRESS' })[];
}

export interface SimulationHistory {
  month: string; // e.g., 2025-09
  generatedAt: string; // ISOString
  characters: Character[];
}
