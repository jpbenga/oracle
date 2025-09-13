
import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard'; 
import { ProfilePage } from './pages/profile-page/profile-page';
import { LoginPage } from './pages/login-page/login-page';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: Dashboard,
        canActivate: [authGuard] 
    },
    {
        path: 'profile',
        component: ProfilePage,
        canActivate: [authGuard]
    },
    {
        path: 'login',
        component: LoginPage
    }
];
