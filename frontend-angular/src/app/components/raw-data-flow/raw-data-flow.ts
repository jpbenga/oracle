import { Component, Output, EventEmitter, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@app/services/api.service';
import { Observable } from 'rxjs';
import { MarketTranslatePipe } from '@app/pipes/market-translate.pipe';
import { ShortlistResponse } from '@app/types/api-types';

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

  ngOnInit(): void {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedDayOffset);
    this.shortlist$ = this.apiService.getShortlist(date);
  }

  onClose(): void {
    this.close.emit();
  }
}