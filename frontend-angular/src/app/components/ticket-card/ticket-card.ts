
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ticket } from '../../types/api-types';
import { MarketTranslatePipe } from '@app/pipes/market-translate.pipe';

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule, MarketTranslatePipe],
  templateUrl: './ticket-card.html',
  styleUrls: ['./ticket-card.scss']
})
export class TicketCard {
  @Input() ticket!: Ticket;
  objectKeys = Object.keys;

  getTrancheKey(score: number): string {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    return "0-59";
  }
}
