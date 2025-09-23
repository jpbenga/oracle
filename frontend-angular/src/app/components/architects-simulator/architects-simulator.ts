import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character } from '../../types/api-types';
import { CharacterCard } from '../character-card/character-card';
import { ApiService } from '@app/services/api.service';
import { Observable } from 'rxjs';
import { SimulationHistoryComponent } from '../simulation-history/simulation-history.component';

@Component({
  selector: 'app-architects-simulator',
  standalone: true,
  imports: [CommonModule, CharacterCard, SimulationHistoryComponent],
  templateUrl: './architects-simulator.html',
  styleUrls: ['./architects-simulator.scss']
})
export class ArchitectsSimulator implements OnInit {
  private apiService = inject(ApiService);

  characters$!: Observable<Character[]>;
  showHistory = false;

  ngOnInit(): void {
    this.characters$ = this.apiService.getSimulationCharacters();
  }

  toggleHistory(): void {
    this.showHistory = !this.showHistory;
  }
}