import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character, Ticket } from '@app/types/api-types';

@Component({
  selector: 'app-character-history-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-history-modal.component.html',
  styleUrls: ['./character-history-modal.component.scss']
})
export class CharacterHistoryModalComponent implements OnInit {
  @Input() character!: Character;
  @Input() allMonthTickets: Ticket[] = [];
  @Output() close = new EventEmitter<void>();

  characterTickets: Ticket[] = [];

  ngOnInit(): void {
    // The simulation processes won/lost tickets. We display the same tickets here.
    this.characterTickets = this.allMonthTickets.filter(t => t.status === 'won' || t.status === 'lost');
  }

  closeModal(): void {
    this.close.emit();
  }
}
