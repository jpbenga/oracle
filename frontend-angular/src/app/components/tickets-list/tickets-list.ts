
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketCard } from '../ticket-card/ticket-card';
import { Ticket, TicketsApiResponse } from '../../types/api-types';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-tickets-list',
  standalone: true,
  imports: [CommonModule, TicketCard, EmptyStateComponent],
  templateUrl: './tickets-list.html',
  styleUrls: ['./tickets-list.scss']
})
export class TicketsList {
  @Input() ticketsData: TicketsApiResponse | null = null;
  @Input() selectedDayOffset: number = 0;

  get selectedDayKey(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    return date.toISOString().split('T')[0];
  }

  private get ticketsForSelectedDay(): Ticket[] {
    if (!this.ticketsData) {
      return [];
    }
    const dayData = this.ticketsData[this.selectedDayKey];
    if (!dayData) {
      return [];
    }
    return Object.values(dayData).flat();
  }

  private calculateTicketScore(ticket: Ticket): number {
    if (!ticket.bets || ticket.bets.length === 0) {
      return 0;
    }
    const totalScore = ticket.bets.reduce((acc, bet) => acc + bet.score, 0);
    return totalScore / ticket.bets.length;
  }

  get sortedTickets(): Ticket[] {
    return this.ticketsForSelectedDay.sort((a, b) => this.calculateTicketScore(b) - this.calculateTicketScore(a));
  }

  get oraclesChoice(): Ticket | null {
    return this.sortedTickets.length > 0 ? this.sortedTickets[0] : null;
  }

  get otherTickets(): Ticket[] {
    return this.sortedTickets.slice(1);
  }

  get areTicketsAvailable(): boolean {
    return this.ticketsForSelectedDay.length > 0;
  }
}
