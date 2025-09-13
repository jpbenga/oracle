import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'marketTranslate',
  standalone: true,
})
export class MarketTranslatePipe implements PipeTransform {
  private translations: { [key: string]: string } = {
    // 1X2
    'home_win': 'Victoire Domicile',
    'away_win': 'Victoire Extérieur',
    'draw': 'Match Nul',
    'favorite_win': 'Favori Vainqueur',
    'outsider_win': 'Outsider Vainqueur',
    'double_chance_favorite': 'Double Chance Favori',
    'double_chance_outsider': 'Double Chance Outsider',

    // Both Teams To Score
    'btts': 'Les 2 Équipes Marquent',
    'btts_no': 'Les 2 Équipes Ne Marquent Pas',

    // Total de Buts (Match)
    'match_over_0.5': '+0.5 Buts',
    'match_under_0.5': '-0.5 Buts',
    'match_over_1.5': '+1.5 Buts',
    'match_under_1.5': '-1.5 Buts',
    'match_over_2.5': '+2.5 Buts',
    'match_under_2.5': '-2.5 Buts',
    'match_over_3.5': '+3.5 Buts',
    'match_under_3.5': '-3.5 Buts',

    // Total de Buts (Mi-temps)
    'ht_over_0.5': '+0.5 Buts (1MT)',
    'ht_under_0.5': '-0.5 Buts (1MT)',
    'ht_over_1.5': '+1.5 Buts (1MT)',
    'ht_under_1.5': '-1.5 Buts (1MT)',

    // Total de Buts (2ème Mi-temps)
    'st_over_0.5': '+0.5 Buts (2MT)',
    'st_under_0.5': '-0.5 Buts (2MT)',
    'st_over_1.5': '+1.5 Buts (2MT)',
    'st_under_1.5': '-1.5 Buts (2MT)',

    // Buts Équipe Domicile
    'home_over_0.5': '+0.5 Buts (Domicile)',
    'home_under_0.5': '-0.5 Buts (Domicile)',
    'home_over_1.5': '+1.5 Buts (Domicile)',
    'home_under_1.5': '-1.5 Buts (Domicile)',

    // Buts Équipe Extérieur
    'away_over_0.5': '+0.5 Buts (Extérieur)',
    'away_under_0.5': '-0.5 Buts (Extérieur)',
    'away_over_1.5': '+1.5 Buts (Extérieur)',
    'away_under_1.5': '-1.5 Buts (Extérieur)',
  };

  transform(value: string): string {
    return this.translations[value] || value;
  }
}
