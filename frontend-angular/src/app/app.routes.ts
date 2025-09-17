// Fichier : frontend-angular/src/app/app.routes.ts (modifié)

import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard'; 
import { ProfilePage } from './pages/profile-page/profile-page';
import { LoginPage } from './pages/login-page/login-page';
// L'import de authGuard a été commenté ou peut être supprimé car il n'est plus utilisé
// import { authGuard } from './services/auth.guard';

export const routes: Routes = [
    {
        path: '', // Le chemin racine pointe maintenant directement au Dashboard
        component: Dashboard
        // canActivate a été retiré
    },
    {
        path: 'profile',
        component: ProfilePage
        // canActivate a été retiré
    },
    {
        path: 'login',
        component: LoginPage
    }
];