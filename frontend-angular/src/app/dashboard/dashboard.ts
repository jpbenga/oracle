import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';
// import { AuthService } from '../services/auth.service';
import { DaySelector } from '../components/day-selector/day-selector';
import { TicketsList } from '../components/tickets-list/tickets-list';
import { ArchitectsSimulator } from '../components/architects-simulator/architects-simulator';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';
import { RawDataFlow } from '../components/raw-data-flow/raw-data-flow';
import { PredictionsApiResponse, Ticket, TicketsApiResponse } from '../types/api-types';
import { catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DaySelector,
    TicketsList,
    ArchitectsSimulator,
    EmptyStateComponent,
    RawDataFlow
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  predictionsData: PredictionsApiResponse = {};
  ticketsData: TicketsApiResponse = {};
  isLoading = true;
  error: { title: string, message: string } | null = null;
  selectedDayOffset = 0;
  sevenDayRate: number = 0;
  historicalTickets: Ticket[] = [];
  showRawData = false;

  // authService = inject(AuthService);
  apiService = inject(ApiService);
  objectKeys = Object.keys;

  ngOnInit(): void {
    // this.loadInitialStats();
    const date = this.getDateFromOffset(0);
    this.loadDataForDate(date);
  }

  // loadInitialStats(): void {
  //   this.apiService.getDashboardStats().subscribe((response: any) => {
  //     const stats = response.data;
  //     this.sevenDayRate = stats.sevenDayRate;
  //     this.historicalTickets = stats.historicalTickets;
  //   });
  // }

  openRawData(): void {
    this.showRawData = true;
  }

  closeRawData(): void {
    this.showRawData = false;
  }

  loadDataForDate(date: string): void {
    console.log(`[Dashboard] Chargement des données pour la date : ${date}`); // LOG 1
    this.isLoading = true;
    this.error = null;
    this.predictionsData = {};
    this.ticketsData = {};

    this.apiService.getTickets(date).pipe(
      catchError(err => {
        if (err.status !== 404) {
          console.error("Erreur API (Tickets):", err);
          if (!this.error) { // Display the first error that occurs
            this.error = {
              title: 'Signal Interrompu',
              message: 'Impossible de matérialiser les tickets. Le signal vers le Mainframe est perdu.'
            };
          }
        }
        return of([]);
      }),
      tap(() => {
        if (this.error) { // If an error occurred, stop loading
          this.isLoading = false;
        }
      })
    ).subscribe(data => {
      if (data && data.length > 0) {
        const ticketsByTitle: { [title: string]: Ticket[] } = {};
        (data || []).forEach(ticket => {
            if (!ticketsByTitle[ticket.title]) {
                ticketsByTitle[ticket.title] = [];
            }
            ticketsByTitle[ticket.title].push(ticket);
        });
        this.ticketsData = {
            [date]: ticketsByTitle
        };
      } else {
        this.ticketsData = {};
      }
      this.isLoading = false; // Also stop loading on success
    });
  }
  
  handleDaySelect(offset: number): void {
    this.selectedDayOffset = offset;
    const date = this.getDateFromOffset(offset);
    this.loadDataForDate(date);
  }

  getDateFromOffset(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  }
}
