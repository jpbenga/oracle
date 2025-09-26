
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Prediction, Ticket } from '../../types/api-types';
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

  private calculateHistoricalQuality(perf: Prediction['market_performance']): number {
    if (!perf) {
      return 0;
    }
    const highTranches = ['70-79', '80-89', '90-100'];
    let success = 0, total = 0;
    highTranches.forEach(key => {
        const t = perf[key] || { success: 0, total: 0 };
        success += t.success;
        total += t.total;
    });
    if (total === 0) return 0;
    const rate = success / total;
    const volume_factor = Math.min(1, total / 50);
    return rate * volume_factor;
  }

  private calculatePredictionQuality(pred: Prediction): number {
      const confidence = pred.score / 100;
      const historicalQuality = this.calculateHistoricalQuality(pred.market_performance);
      return confidence * historicalQuality;
  }

  get compositeScore(): number {
    if (!this.ticket || !this.ticket.bets || this.ticket.bets.length === 0) {
      return 0;
    }

    const qualities = this.ticket.bets.map(bet => this.calculatePredictionQuality(bet));

    if (this.ticket.bets.length === 1) {
      const pred = this.ticket.bets[0];
      return (pred.odd || 0) * qualities[0];
    }

    const avgQuality = qualities.reduce((acc, q) => acc + q, 0) / qualities.length;
    const minQuality = Math.min(...qualities);
    return this.ticket.totalOdd * avgQuality * minQuality;
  }

  getTrancheKey(score: number): string {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    return "0-59";
  }
}
