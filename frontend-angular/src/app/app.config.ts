import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';

// Imports Firebase à réintroduire
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getFunctions, provideFunctions } from '@angular/fire/functions';

// Assurez-vous que cette configuration est correcte !
const firebaseConfig = {
  apiKey: "AIzaSyBSYrbOMBpSxuHzPIsoj8ymqsvcvM6KTgU",
  authDomain: "oracle-prediction-app.firebaseapp.com",
  projectId: "oracle-prediction-app",
  storageBucket: "oracle-prediction-app.firebasestorage.app",
  messagingSenderId: "321557095918",
  appId: "1:321557095918:web:4f478a7c08792c532adaff",
  measurementId: "G-8Y6YRT96DK"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Providers Firebase à remettre
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions())
  ]
};