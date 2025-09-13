
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
}
