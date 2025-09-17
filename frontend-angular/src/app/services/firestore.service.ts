import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

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

  // Vous pouvez ajouter ici d'autres méthodes pour ajouter, modifier ou supprimer des documents.
}
