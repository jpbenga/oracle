import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character } from '../../types/api-types';

@Component({
  selector: 'app-character-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-card.html',
  styleUrls: ['./character-card.scss']
})
export class CharacterCard {
  @Input() character!: Character;

  get progressPercentage(): number {
    return (this.character.progress / this.character.goal) * 100;
  }
}