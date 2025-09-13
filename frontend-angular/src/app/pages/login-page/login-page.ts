import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.scss']
})
export class LoginPage {
  email = '';
  password = '';
  isLoading = false;
  error: string | null = null;

  private authService = inject(AuthService);
  private router = inject(Router);

  async handleRegister() {
    this.isLoading = true;
    this.error = null;
    try {
      await this.authService.register({ email: this.email, password: this.password });
      this.router.navigate(['/']);
    } catch (e: any) {
      this.error = this.getFirebaseErrorMessage(e.code);
    }
    this.isLoading = false;
  }

  async handleLogin() {
    this.isLoading = true;
    this.error = null;
    try {
      await this.authService.login({ email: this.email, password: this.password });
      this.router.navigate(['/']);
    } catch (e: any) {
      this.error = this.getFirebaseErrorMessage(e.code);
    }
    this.isLoading = false;
  }

  private getFirebaseErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Adresse email invalide.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email ou mot de passe incorrect.';
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée.';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères.';
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }
}