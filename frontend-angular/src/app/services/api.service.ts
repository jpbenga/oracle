import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Ticket } from '../types/api-types';
import { Firestore, collection, query, where, onSnapshot, DocumentData, CollectionReference } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private firestore: Firestore = inject(Firestore);
  private functions: Functions = inject(Functions);

  constructor() { }

  private createRealtimeObservable<T>(ref: CollectionReference, date: string): Observable<T[]> {
    const q = query(ref, where("date", "==", date));

    return new Observable<T[]>(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const results: T[] = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() } as T);
        });
        observer.next(results);
      }, (error) => {
        console.error(`Erreur de souscription en temps réel pour ${ref.path}:`, error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getDashboardStats(): Observable<any> {
    const getStats = httpsCallable(this.functions, 'getDashboardStats');
    return from(getStats());
  }

  getTickets(date: string): Observable<Ticket[]> {
    const ticketsCollection = collection(this.firestore, 'tickets') as CollectionReference<DocumentData>;
    return this.createRealtimeObservable<Ticket>(ticketsCollection, date);
  }

  getShortlist(): Observable<any[]> {
    const shortlistCollection = collection(this.firestore, 'shortlist');
    const q = query(shortlistCollection);

    return new Observable<any[]>(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const results: any[] = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        observer.next(results);
      }, (error) => {
        console.error(`Erreur de souscription en temps réel pour la shortlist:`, error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }
}
