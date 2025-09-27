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
  @Input() characterTickets: Ticket[] = [];
  @Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    // The component now receives a pre-filtered list of tickets.
  }

  closeModal(): void {
    this.close.emit();
  }

  getTicketProfit(ticket: Ticket): number {
    if (ticket.status === 'won') {
      // Note: This assumes the bet amount for the progression is the character's initialBankroll
      return (this.character.initialBankroll * ticket.totalOdd) - this.character.initialBankroll;
    } else if (ticket.status === 'lost') {
      return this.character.initialBankroll;
    }
    return 0;
  }
}
