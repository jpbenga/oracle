import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ticket } from '../../types/api-types';
import { CharacterCard } from '../character-card/character-card';

interface Character {
  name: string;
  goal: number;
  bankroll: number;
  initialBankroll: number;
  progress: number;
  performance: number;
}

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

  private initialCharacters: Character[] = [
    { name: 'Cypher', goal: 1, bankroll: 20, initialBankroll: 20, progress: 0, performance: 0 },
    { name: 'Morpheus', goal: 2, bankroll: 20, initialBankroll: 20, progress: 0, performance: 0 },
    { name: 'Trinity', goal: 3, bankroll: 20, initialBankroll: 20, progress: 0, performance: 0 },
    { name: 'Neo', goal: 4, bankroll: 20, initialBankroll: 20, progress: 0, performance: 0 },
    { name: "L'Oracle", goal: 5, bankroll: 20, initialBankroll: 20, progress: 0, performance: 0 }
  ];

  constructor() {
    this.characters = JSON.parse(JSON.stringify(this.initialCharacters));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['historicalTickets'] || changes['selectedDayOffset']) {
      this.runSimulation();
    }
  }

  private runSimulation(): void {
    let simulatedCharacters: Character[] = JSON.parse(JSON.stringify(this.initialCharacters));

    const sortedTickets = this.historicalTickets
      .filter(t => t.title === "The Oracle's Choice" && (t.status === 'won' || t.status === 'lost'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
        }
      });
    }
    this.characters = simulatedCharacters;
  }
}