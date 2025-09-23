import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-day-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day-selector.html',
  styleUrls: ['./day-selector.scss']
})
export class DaySelector {
  @Input() selectedDayOffset: number = 0;
  @Output() selectDay = new EventEmitter<number>();

  // Limiter les jours de J-6 à J+1 (total de 8 jours)
  dayOffsets: number[] = Array.from({ length: 8 }, (_, i) => i - 6);

  getDateForOffset(offset: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  }

  formatDate(date: Date, offset: number): string {
    if (offset === 0) return 'Aujourd\'hui';
    // Utiliser le format français pour les jours
    const day = date.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dateNum = date.getDate();
    // Mettre la première lettre en majuscule
    return `${day.charAt(0).toUpperCase() + day.slice(1)} ${dateNum}`;
  }

  onSelectDay(offset: number): void {
    this.selectDay.emit(offset);
  }

  prevDay(): void {
    if (this.selectedDayOffset > -6) {
      this.onSelectDay(this.selectedDayOffset - 1);
    }
  }

  nextDay(): void {
    // Mettre à jour la limite à J+1
    if (this.selectedDayOffset < 1) {
      this.onSelectDay(this.selectedDayOffset + 1);
    }
  }
}