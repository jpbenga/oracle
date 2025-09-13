import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-info.html',
  styleUrls: ['./user-info.scss']
})
export class UserInfo {
  userEmail = 'neo@oracle.com';
}