import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisplayPrediction } from '@app/types/api-types';

@Component({
  selector: 'app-prediction-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prediction-card.html',
  styleUrls: ['./prediction-card.scss']
})
export class PredictionCard {
  @Input() prediction!: DisplayPrediction;
  @Input() isPast: boolean = false;
  @Input() isFuture: boolean = false;

  get isIncorrect(): boolean {
    return this.isPast && this.prediction.result === false;
  }
}
