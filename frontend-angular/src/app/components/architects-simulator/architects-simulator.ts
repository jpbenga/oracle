import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character, Ticket } from '@app/types/api-types';
import { CharacterCard } from '../character-card/character-card';
import { ApiService } from '@app/services/api.service';
import { Observable, map } from 'rxjs';
import { SimulationHistoryComponent } from '../simulation-history/simulation-history.component';
import { CharacterHistoryModalComponent } from '../character-history-modal/character-history-modal.component';

@Component({
  selector: 'app-architects-simulator',
  standalone: true,
  imports: [CommonModule, CharacterCard, SimulationHistoryComponent, CharacterHistoryModalComponent],
  templateUrl: './architects-simulator.html',
  styleUrls: ['./architects-simulator.scss']
})
export class ArchitectsSimulator implements OnInit {
  private apiService = inject(ApiService);

  characters$!: Observable<Character[]>;
  allMonthTickets: Ticket[] = [];
  selectedCharacter: Character | null = null;

  otherCharactersVisible = false;
  isMobile = window.innerWidth < 768; // Tailwind's md breakpoint

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isMobile = event.target.innerWidth < 768;
  }

  private initialCharacters: Character[] = [
    { name: 'Cypher', goal: 1, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Morpheus', goal: 2, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Trinity', goal: 3, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Neo', goal: 4, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: "L'Oracle", goal: 5, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 }
  ];

  ngOnInit(): void {
    this.characters$ = this.apiService.getSimulationCharacters().pipe(
      map(characters => characters.length > 0 ? characters : this.initialCharacters)
    );

    this.apiService.getTicketsForCurrentMonth().subscribe(tickets => {
      this.allMonthTickets = tickets;
    });
  }

  onCharacterCardClick(character: Character): void {
    this.selectedCharacter = character;
  }

  closeHistoryModal(): void {
    this.selectedCharacter = null;
  }

  toggleMatrix(): void {
    this.otherCharactersVisible = !this.otherCharactersVisible;
  }
}