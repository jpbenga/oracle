import { Component, Output, EventEmitter, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@app/services/api.service';
import { Observable, map } from 'rxjs';
import { MarketTranslatePipe } from '@app/pipes/market-translate.pipe';
import { Prediction, ShortlistResponse } from '@app/types/api-types';

@Component({
  selector: 'app-raw-data-flow',
  standalone: true,
  imports: [CommonModule, MarketTranslatePipe],
  templateUrl: './raw-data-flow.html',
  styleUrls: ['./raw-data-flow.scss']
})
export class RawDataFlow implements OnInit {
  @Input() selectedDayOffset: number = 0;
  @Output() close = new EventEmitter<void>();
  
  private apiService = inject(ApiService);
  public shortlist$!: Observable<ShortlistResponse>;
  public expandedPredictionId: string | null = null;
  objectKeys = Object.keys;

  ngOnInit(): void {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    this.shortlist$ = this.apiService.getShortlist(date).pipe(
      map(shortlist => {
        if (!shortlist || !shortlist.predictions) return shortlist;

        const marketPerformanceMap = new Map<string, Prediction['market_performance']>();

        // First pass: populate the map
        for (const prediction of shortlist.predictions) {
          if (prediction.market && prediction.market_performance && Object.keys(prediction.market_performance).length > 0) {
            if (!marketPerformanceMap.has(prediction.market)) {
              marketPerformanceMap.set(prediction.market, prediction.market_performance);
            }
          }
        }

        // Second pass: fill in missing data
        const predictions = shortlist.predictions.map(prediction => {
          if (prediction.market && (!prediction.market_performance || Object.keys(prediction.market_performance).length === 0)) {
            const performance = marketPerformanceMap.get(prediction.market);
            if (performance) {
              return { ...prediction, market_performance: performance };
            }
          }
          return prediction;
        });

        return { ...shortlist, predictions };
      })
    );
  }

  onClose(): void {
    this.close.emit();
  }

  toggleDetails(predictionId: string): void {
    if (this.expandedPredictionId === predictionId) {
      this.expandedPredictionId = null;
    } else {
      this.expandedPredictionId = predictionId;
    }
  }

  getTrancheKey(score: number): string {
    if (score >= 90) return "90-100";
    if (score >= 80) return "80-89";
    if (score >= 70) return "70-79";
    if (score >= 60) return "60-69";
    return "0-59";
  }
}