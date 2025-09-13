import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subscription-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-manager.html',
  styleUrls: ['./subscription-manager.scss']
})
export class SubscriptionManager {
  @Input() isPremium: boolean = false;

  mockInvoices = [
    { id: 1, date: 'Août 2023', amount: '9.99€' },
    { id: 2, date: 'Juillet 2023', amount: '9.99€' },
    { id: 3, date: 'Juin 2023', amount: '9.99€' }
  ];
}