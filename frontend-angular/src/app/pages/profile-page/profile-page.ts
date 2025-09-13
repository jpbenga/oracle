
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserInfo } from '../../components/profile/user-info/user-info';
import { ChangePassword } from '../../components/profile/change-password/change-password';
import { SubscriptionManager } from '../../components/profile/subscription-manager/subscription-manager';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, RouterModule, UserInfo, ChangePassword, SubscriptionManager],
  templateUrl: './profile-page.html',
  styleUrls: ['./profile-page.scss']
})
export class ProfilePage {
  @Input() isPremium: boolean = false;
}
