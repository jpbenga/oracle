import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Ticket } from '../types/api-types';
import { Firestore, collection, query, where, onSnapshot, DocumentData, CollectionReference } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  private createRealtimeObservable<T>(ref: CollectionReference, date: string): Observable<T[]> {
    const q = query(ref, where("date", "==", date));

    return new Observable<T[]>(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const results: T[] = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() } as T);
        });
        console.log('[ApiService] Données brutes reçues de Firestore (getTickets):', results); // LOG 2
        observer.next(results);
      }, (error) => {
        console.error(`Erreur de souscription en temps réel pour ${ref.path}:`, error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getTickets(date: string): Observable<Ticket[]> {
    const ticketsCollection = collection(this.firestore, 'tickets') as CollectionReference<DocumentData>;
    return this.createRealtimeObservable<Ticket>(ticketsCollection, date);
  }

  getShortlist(date: Date): Observable<any[]> {
    const predictionsCollection = collection(this.firestore, 'predictions');

    // Calculer le début et la fin de la journée pour la date fournie
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const q = query(predictionsCollection, 
      where("matchDate", ">=", startOfDay.toISOString()),
      where("matchDate", "<=", endOfDay.toISOString()),
      where("odd", ">=", 1.25)
    );

    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const results: any[] = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        console.log('[ApiService] Données brutes reçues de Firestore (Prédictions):', results);
        // Tri par date de match
        results.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
        observer.next(results);
      }, (error) => {
        console.error(`Erreur de souscription en temps réel pour les prédictions:`, error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }
}
