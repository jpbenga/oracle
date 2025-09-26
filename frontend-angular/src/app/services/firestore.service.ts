import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Prediction, ShortlistResponse } from '@app/types/api-types';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  /**
   * Récupère une collection de documents depuis Firestore.
   * @param collectionName Le nom de la collection.
   * @returns Un Observable avec le tableau des documents.
   */
  getCollection<T>(collectionName: string): Observable<T[]> {
    const dataCollection = collection(this.firestore, collectionName);
    return collectionData(dataCollection, { idField: 'id' }) as Observable<T[]>;
  }

  getShortlistRealtime(date: Date): Observable<ShortlistResponse> {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

    const predictionsCollection = collection(this.firestore, 'predictions');
    const q = query(
      predictionsCollection,
      where('matchDate', '>=', start.toISOString()),
      where('matchDate', '<=', end.toISOString()),
      orderBy('matchDate', 'asc')
    );

    return (collectionData(q, { idField: 'id' }) as Observable<Prediction[]>).pipe(
      map((predictions: Prediction[]) => {
        // Appliquer le filtre sur la cote comme demandé
        const filteredPredictions = predictions.filter(p => p.odd != null && p.odd >= 1.3);

        const predictionsWithStatus = filteredPredictions.map(p => {
          let resultStatus: 'WON' | 'LOST' | 'UNKNOWN' | 'IN_PROGRESS' = 'UNKNOWN';
          if (p.result === 'WON') {
            resultStatus = 'WON';
          } else if (p.result === 'LOST') {
            resultStatus = 'LOST';
          }
          // Note: IN_PROGRESS status might need more complex logic if required
          return { ...p, resultStatus };
        });

        return {
          report: null, // Report data is not part of this specific query
          predictions: predictionsWithStatus,
        };
      })
    );
  }

  // Vous pouvez ajouter ici d'autres méthodes pour ajouter, modifier ou supprimer des documents.
}
