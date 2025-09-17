import { Component, Output, EventEmitter, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@app/services/api.service';
import { Observable } from 'rxjs';
import { MarketTranslatePipe } from '@app/pipes/market-translate.pipe';

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
  public shortlist$!: Observable<any[]>;

  constructor() {
    console.log('[RawDataFlow] Le constructeur est appelé !');
  }

  ngOnInit(): void {
    console.log(`[RawDataFlow] Initialisation du composant avec l'offset : ${this.selectedDayOffset}`);
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    console.log(`[RawDataFlow] Date calculée pour la requête : ${date.toISOString()}`);
    this.shortlist$ = this.apiService.getShortlist(date);
    console.log('[RawDataFlow] Observable de prédictions créé. En attente de souscription par le template...');
  }

  onClose(): void {
    this.close.emit();
  }
}