
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Dashboard } from './dashboard/dashboard';
import { ProfilePage } from './pages/profile-page/profile-page';
import { Auth, signInAnonymously } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('frontend-angular');
  private auth: Auth = inject(Auth);

  ngOnInit(): void {
    signInAnonymously(this.auth).then(() => {
      console.log('Connexion anonyme réussie.');
    }).catch((error) => {
      console.error('Erreur de connexion anonyme:', error);
    });
  }
}
