import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Ticket, ShortlistResponse, Prediction, PredictionReport, PredictionResult } from '../types/api-types';
import { Firestore, collection, query, where, onSnapshot, DocumentData, CollectionReference, doc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private firestore: Firestore = inject(Firestore);
  private http: HttpClient = inject(HttpClient);
  private baseUrl = 'https://get-monthly-oracle-tickets-182845783611.europe-west1.run.app'; // Assumed base URL

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
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  getTickets(date: string): Observable<Ticket[]> {
    const ticketsCollection = collection(this.firestore, 'tickets') as CollectionReference<DocumentData>;
    return this.createRealtimeObservable<Ticket>(ticketsCollection, date);
  }

  getMonthlyOracleTickets(selectedDayOffset: number): Observable<Ticket[]> {
    return this.http.post<{data: Ticket[]}>(`${this.baseUrl}/getMonthlyOracleTickets`, { data: { selectedDayOffset } })
      .pipe(map(response => response.data));
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