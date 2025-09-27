import { Injectable, inject } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Ticket, ShortlistResponse, Prediction, PredictionReport, PredictionResult, Character, SimulationHistory } from '../types/api-types';
import { Firestore, collection, query, where, onSnapshot, DocumentData, CollectionReference, doc, orderBy } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private firestore: Firestore = inject(Firestore);
  private firestoreService = inject(FirestoreService);

  constructor() { }

  getSimulationCharacters(): Observable<Character[]> {
    return this.firestoreService.getCollection<Character>('simulation_characters');
  }

  getSimulationHistory(): Observable<SimulationHistory[]> {
    const historyCollection = collection(this.firestore, 'simulation_history');
    const q = query(historyCollection, orderBy('month', 'desc'));
    
    return new Observable<SimulationHistory[]>(observer => {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const results: SimulationHistory[] = [];
        querySnapshot.forEach((doc) => {
          results.push(doc.data() as SimulationHistory);
        });
        observer.next(results);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

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
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getTickets(date: string): Observable<Ticket[]> {
    const ticketsCollection = collection(this.firestore, 'tickets') as CollectionReference<DocumentData>;
    return this.createRealtimeObservable<Ticket>(ticketsCollection, date);
  }

  getTicketsForCurrentMonth(): Observable<Ticket[]> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const ticketsQuery = query(
      collection(this.firestore, 'tickets'),
      where('date', '>=', firstDayOfMonth.toISOString().split('T')[0]),
      where('date', '<=', lastDayOfMonth.toISOString().split('T')[0])
    );

    return new Observable<Ticket[]>(observer => {
      const unsubscribe = onSnapshot(ticketsQuery, (querySnapshot) => {
        const tickets: Ticket[] = [];
        querySnapshot.forEach((doc) => {
          tickets.push({ id: doc.id, ...doc.data() } as unknown as Ticket);
        });
        observer.next(tickets);
      }, (error) => {
        console.error("[ApiService] Error fetching monthly tickets:", error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getMonthlyOracleTickets(selectedDayOffset: number): Observable<Ticket[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + selectedDayOffset);

    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    const ticketsQuery = query(
      collection(this.firestore, 'tickets'),
      where('title', '==', "The Oracle's Choice"),
      where('date', '>=', firstDayOfMonth.toISOString().split('T')[0]),
      where('date', '<=', lastDayOfMonth.toISOString().split('T')[0])
    );

    return new Observable<Ticket[]>(observer => {
      const unsubscribe = onSnapshot(ticketsQuery, (querySnapshot) => {
        const tickets: Ticket[] = [];
        querySnapshot.forEach((doc) => {
          tickets.push({ id: doc.id, ...doc.data() } as unknown as Ticket);
        });
        // Sort by date ascending
        const sortedTickets = tickets.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        observer.next(sortedTickets);
      }, (error) => {
        console.error("[ApiService] Error fetching monthly oracle tickets:", error);
        observer.error(error);
      });

      // Unsubscribe when the observable is unsubscribed
      return () => unsubscribe();
    });
  }

  getShortlist(date: Date): Observable<ShortlistResponse> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const predictionsQuery = query(
      collection(this.firestore, 'predictions'),
      where("matchDate", ">=", startOfDay.toISOString()),
      where("matchDate", "<=", endOfDay.toISOString()),
      where("odd", ">=", 1.25)
    );

    return new Observable<Prediction[]>(observer => {
      const unsubscribe = onSnapshot(predictionsQuery, (snapshot) => {
        const predictions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prediction));
        
        const fixtureIdToLeagueMap = new Map<number, Prediction['league']>();
        predictions.forEach(p => {
          if (p.fixtureId && p.league) {
            fixtureIdToLeagueMap.set(p.fixtureId, p.league);
          }
        });

        const predictionsWithLeague = predictions.map(p => {
          if (!p.league && p.fixtureId && fixtureIdToLeagueMap.has(p.fixtureId)) {
            return { ...p, league: fixtureIdToLeagueMap.get(p.fixtureId)! };
          }
          return p;
        });

        const uniquePredictions = [];
        const seenIds = new Set();
        for (const p of predictionsWithLeague) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                uniquePredictions.push(p);
            }
        }

        uniquePredictions.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
        console.log('[ApiService] Données brutes reçues de Firestore (Prédictions):', uniquePredictions);
        observer.next(uniquePredictions);
      });
      return () => unsubscribe();
    }).pipe(
      switchMap(predictions => {
        if (predictions.length === 0) {
          return of({ report: null, predictions: [] });
        }

        const executionId = predictions[0].backtestExecutionId;
        if (!executionId) {
          return of({ report: null, predictions: predictions.map(p => ({...p, resultStatus: 'UNKNOWN' as const})) });
        }

        const reportRef = doc(this.firestore, 'prediction_reports', executionId);
        const resultsRef = collection(this.firestore, `prediction_reports/${executionId}/results`);

        const report$ = new Observable<PredictionReport | null>(observer => {
          const unsubscribe = onSnapshot(reportRef, (doc) => {
            observer.next(doc.exists() ? { executionId, ...doc.data() } as PredictionReport : null);
          });
          return () => unsubscribe();
        });

        const results$ = new Observable<PredictionResult[]>(observer => {
          const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
            observer.next(snapshot.docs.map(doc => doc.data() as PredictionResult));
          });
          return () => unsubscribe();
        });

        return combineLatest([report$, results$]).pipe(
          map(([report, results]) => {
            const resultsMap = new Map(results.map(r => [r.predictionId, r.result]));
            const enrichedPredictions = predictions.map((p): Prediction & { resultStatus?: 'WON' | 'LOST' | 'UNKNOWN' | 'IN_PROGRESS' } => {
              const result = resultsMap.get(p.id);
              if (result) {
                return { ...p, resultStatus: result };
              }
              if (report?.status === 'PROCESSING') {
                return { ...p, resultStatus: 'IN_PROGRESS' };
              }
              return { ...p, resultStatus: 'UNKNOWN' };
            });
            return { report, predictions: enrichedPredictions };
          })
        );
      })
    );
  }
}