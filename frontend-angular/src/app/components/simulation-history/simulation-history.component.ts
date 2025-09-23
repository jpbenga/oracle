import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@app/services/api.service';
import { SimulationHistory } from '@app/types/api-types';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-simulation-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './simulation-history.component.html',
  styleUrls: ['./simulation-history.component.scss']
})
export class SimulationHistoryComponent implements OnInit {
  private apiService = inject(ApiService);
  public history$!: Observable<SimulationHistory[]>;

  ngOnInit(): void {
    this.history$ = this.apiService.getSimulationHistory();
  }
}
