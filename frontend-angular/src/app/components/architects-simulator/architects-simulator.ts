import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ticket, Character } from '../../types/api-types';
import { CharacterCard } from '../character-card/character-card';

@Component({
  selector: 'app-architects-simulator',
  standalone: true,
  imports: [CommonModule, CharacterCard],
  templateUrl: './architects-simulator.html',
  styleUrls: ['./architects-simulator.scss']
})
export class ArchitectsSimulator implements OnChanges {
  @Input() historicalTickets: Ticket[] = [];
  @Input() selectedDayOffset: number = 0;

  characters: Character[] = [];
  monthlyOracleTickets: Ticket[] = [];
  showDetailedView = false;

  private initialCharacters: Character[] = [
    { name: 'Cypher', goal: 1, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Morpheus', goal: 2, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Trinity', goal: 3, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Neo', goal: 4, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: "L'Oracle", goal: 5, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 }
  ];

  constructor() {
    this.characters = JSON.parse(JSON.stringify(this.initialCharacters));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['historicalTickets'] || changes['selectedDayOffset']) {
      this.runSimulation();
    }
  }

  toggleDetailedView(): void {
    this.showDetailedView = !this.showDetailedView;
  }

  private runSimulation(): void {
    let simulatedCharacters: Character[] = JSON.parse(JSON.stringify(this.initialCharacters));

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + this.selectedDayOffset);

    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    const sortedTickets = this.historicalTickets
      .filter(t => {
        const ticketDate = new Date(t.date);
        return t.title === "The Oracle's Choice" &&
               (t.status === 'won' || t.status === 'lost') &&
               ticketDate >= firstDayOfMonth &&
               ticketDate <= lastDayOfMonth;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.monthlyOracleTickets = sortedTickets;

    for (const oracleTicket of sortedTickets) {
      const ticketDate = new Date(oracleTicket.date);
      const today = new Date();
      today.setDate(today.getDate() + this.selectedDayOffset);
      if (ticketDate > today) continue;

      simulatedCharacters.forEach(char => {
        if (oracleTicket.status === 'won') {
          const newBankroll = char.bankroll * oracleTicket.totalOdd;
          const profit = newBankroll - char.bankroll;
          char.bankroll = newBankroll;
          char.progress++;
          char.performance += profit;

          if (char.progress >= char.goal) {
            char.bankroll = char.initialBankroll;
            char.progress = 0;
          }
        } else if (oracleTicket.status === 'lost') {
          char.performance -= char.bankroll;
          char.bankroll = char.initialBankroll;
          char.progress = 0;
          char.losses++;
        }
      });
    }
    this.characters = simulatedCharacters;
  }
}