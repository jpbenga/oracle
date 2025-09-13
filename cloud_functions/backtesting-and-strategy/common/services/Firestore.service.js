const { Firestore } = require('@google-cloud/firestore');
const chalk = require('chalk');

class FirestoreService {
  constructor() {
    this.db = new Firestore();
    this.BACKTEST_SUMMARY_DOC_PATH = 'system_reports/backtest_summary';
  }

  async testConnection() {
    try {
      await this.db.listCollections();
      console.log(chalk.green('[Firestore Service] Connexion à Firestore réussie.'));
      return true;
    } catch (error) {
      console.error(chalk.red('[Firestore Service] Échec de la connexion à Firestore :'), error);
      return false;
    }
  }

  async getLeagueStatus(leagueId) {
    const docRef = this.db.collection('leagues_status').doc(String(leagueId));
    const doc = await docRef.get();
    return doc.exists ? doc.data() : null;
  }

  async updateLeagueStatus(leagueId, data) {
    const docRef = this.db.collection('leagues_status').doc(String(leagueId));
    await docRef.set(data, { merge: true });
  }

  async savePrediction(prediction) {
    const docRef = await this.db.collection('predictions').add(prediction);
    return docRef.id;
  }
    
  async findIncompletePredictions() {
    const snapshot = await this.db.collection('predictions').where('status', '==', 'INCOMPLETE').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async updatePrediction(predictionId, data) {
    await this.db.collection('predictions').doc(predictionId).update(data);
  }

  async deletePendingTicketsForDate(date) {
    const snapshot = await this.db.collection('tickets')
      .where('status', '==', 'PENDING')
      .where('creation_date', '==', date)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  async getEligiblePredictionsForDate(date) {
      const snapshot = await this.db.collection('predictions')
        .where('status', '==', 'ELIGIBLE')
        .where('matchDate', '>=', `${date}T00:00:00Z`)
        .where('matchDate', '<=', `${date}T23:59:59Z`)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  async saveTicket(ticket) {
      await this.db.collection('tickets').add(ticket);
  }

  async getPendingItems() {
    const now = new Date().toISOString();

    const predictionsSnapshot = await this.db.collection('predictions')
      .where('status', '==', 'PENDING')
      .where('matchDate', '<', now)
      .get();

    const ticketsSnapshot = await this.db.collection('tickets')
      .where('status', '==', 'PENDING')
      .get();
      
    return {
      predictions: predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      tickets: ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  }
  
  async updateTicketStatus(ticketId, status) {
      await this.db.collection('tickets').doc(ticketId).update({ status });
  }

  async saveBacktestResult(result) {
    const docRef = this.db.collection('backtest_results').doc(String(result.matchId));
    await docRef.set(result);
    return docRef.id;
  }

  async getAllBacktestResults() {
    const snapshot = await this.db.collection('backtest_results').get();
    return snapshot.docs
        .map(doc => doc.data())
        .filter(doc => doc && Array.isArray(doc.markets));
  }

  async saveBacktestSummary(summary) {
    const docRef = this.db.doc(this.BACKTEST_SUMMARY_DOC_PATH);
    await docRef.set(summary);
  }

  async getBacktestSummary() {
    const docRef = this.db.doc(this.BACKTEST_SUMMARY_DOC_PATH);
    const doc = await docRef.get();
    return doc.exists ? doc.data() : null;
  }

  async saveWhitelist(whitelist) {
    const docRef = this.db.collection('strategy').doc('whitelist');
    await docRef.set(whitelist);
    console.log(chalk.green('[Firestore Service] Whitelist sauvegardée avec succès.'));
  }

  async getWhitelist() {
    const docRef = this.db.collection('strategy').doc('whitelist');
    const doc = await docRef.get();
    return doc.exists ? doc.data() : null;
  }

  async getTicketsForDate(date) {
    const snapshot = await this.db.collection('tickets')
      .where('creation_date', '==', date)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getPredictionsForDate(date) {
    const startDate = `${date}T00:00:00Z`;
    const endDate = `${date}T23:59:59Z`;
    const snapshot = await this.db.collection('predictions')
      .where('matchDate', '>=', startDate)
      .where('matchDate', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async closeConnection() {
    await this.db.terminate();
  }
}

exports.firestoreService = new FirestoreService();