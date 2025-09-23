import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'marketTranslate',
  standalone: true,
})
export class MarketTranslatePipe implements PipeTransform {
  private translations: { [key: string]: string } = {
    // 1X2 & Match Odds
    'Match Odds': 'Résultat du Match',
    'home_win': 'Équipe à domicile gagne',
    'away_win': 'Équipe à l\'extérieur gagne',
    'draw': 'Match Nul',
    'favorite_win': 'Le favori gagne',
    'outsider_win': 'L\'outsider gagne',
    
    // Double Chance
    'double_chance_favorite': 'Double Chance (Favori ou Nul)',
    'double_chance_outsider': 'Double Chance (Outsider ou Nul)',
    'home_draw': 'Double Chance (Domicile ou Nul)',
    'away_draw': 'Double Chance (Extérieur ou Nul)',
    'home_away': 'Double Chance (Domicile ou Extérieur)',

    // Both Teams To Score
    'btts': 'Les 2 équipes marquent',
    'btts_no': 'Une seule ou aucune équipe ne marque',

    // Total de Buts (Match)
    'match_over_0.5': '+0.5 buts dans le match',
    'match_under_0.5': '-0.5 buts dans le match',
    'match_over_1.5': '+1.5 buts dans le match',
    'match_under_1.5': '-1.5 buts dans le match',
    'match_over_2.5': '+2.5 buts dans le match',
    'match_under_2.5': '-2.5 buts dans le match',
    'match_over_3.5': '+3.5 buts dans le match',
    'match_under_3.5': '-3.5 buts dans le match',

    // Total de Buts (Mi-temps)
    'ht_over_0.5': '+0.5 buts en 1ère mi-temps',
    'ht_under_0.5': '-0.5 buts en 1ère mi-temps',
    'ht_over_1.5': '+1.5 buts en 1ère mi-temps',
    'ht_under_1.5': '-1.5 buts en 1ère mi-temps',

    // Total de Buts (2ème Mi-temps)
    'st_over_0.5': '+0.5 buts en 2ème mi-temps',
    'st_under_0.5': '-0.5 buts en 2ème mi-temps',
    'st_over_1.5': '+1.5 buts en 2ème mi-temps',
    'st_under_1.5': '-1.5 buts en 2ème mi-temps',

    // Buts Équipe Domicile
    'home_over_0.5': '+0.5 buts (Domicile)',
    'home_under_0.5': '-0.5 buts (Domicile)',
    'home_over_1.5': '+1.5 buts (Domicile)',
    'home_under_1.5': '-1.5 buts (Domicile)',

    // Buts Équipe Extérieur
    'away_over_0.5': '+0.5 buts (Extérieur)',
    'away_under_0.5': '-0.5 buts (Extérieur)',
    'away_over_1.5': '+1.5 buts (Extérieur)',
    'away_under_1.5': '-1.5 buts (Extérieur)',

    // Handicaps Asiatiques Simples
    'asian_handicap_home_-0.5': 'Handicap Asiatique : Domicile -0.5',
    'asian_handicap_away_+0.5': 'Handicap Asiatique : Extérieur +0.5',
    'asian_handicap_home_+0.5': 'Handicap Asiatique : Domicile +0.5',
    'asian_handicap_away_-0.5': 'Handicap Asiatique : Extérieur -0.5',
  };

  transform(value: string): string {
    return this.translations[value] || value;
  }
}
