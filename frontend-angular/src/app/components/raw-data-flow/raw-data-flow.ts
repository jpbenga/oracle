import { Component, Output, EventEmitter, inject } from '@angular/core';
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
export class RawDataFlow {
  @Output() close = new EventEmitter<void>();
  
  private apiService = inject(ApiService);
  public shortlist$: Observable<any[]>;

  constructor() {
    this.shortlist$ = this.apiService.getShortlist();
  }

  onClose(): void {
    this.close.emit();
  }
}