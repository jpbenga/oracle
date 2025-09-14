const { Firestore } = require('@google-cloud/firestore');
const chalk = require('chalk');

class FirestoreService {
  constructor() {
    this.db = new Firestore({
      projectId: 'oracle-prediction-firebase'
    });
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
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    const predictionToSave = {
      ...prediction,
      expireAt: oneYearFromNow,
    };

    const docRef = await this.db.collection('predictions').add(predictionToSave);
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
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      const ticketToSave = {
        ...ticket,
        expireAt: oneYearFromNow,
      };

      await this.db.collection('tickets').add(ticketToSave);
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

  async saveBacktestResult(result, executionId) {
    const docRef = this.db.collection('backtest_results').doc(String(result.matchId));
    const resultToSave = {
      ...result,
      executionId: executionId,
    };
    await docRef.set(resultToSave, { merge: true });
    return docRef.id;
  }

  async getAllBacktestResults() {
    const snapshot = await this.db.collection('backtest_results').get();
    return snapshot.docs
        .map(doc => doc.data())
        .filter(doc => doc && Array.isArray(doc.markets));
  }

  async saveBacktestRun(executionId, runData) {
    const docRef = this.db.collection('backtest_runs').doc(executionId);
    
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    const dataToSave = {
      ...runData,
      executionId: executionId,
      createdAt: new Date(),
      expireAt: oneYearFromNow,
    };

    await docRef.set(dataToSave);
    console.log(chalk.green(`[Firestore Service] Backtest run ${executionId} saved successfully.`));
  }

  async getLatestBacktestRun() {
    const snapshot = await this.db.collection('backtest_runs')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(chalk.yellow('[Firestore Service] No backtest runs found.'));
      return null;
    }
    
    console.log(chalk.green('[Firestore Service] Latest backtest run loaded successfully.'));
    return snapshot.docs[0].data();
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

  async getPredictionsWithoutFinalResult() {
    const snapshot = await this.db.collection('predictions')
        .where('status', 'in', ['ELIGIBLE', 'INCOMPLETE'])
        .get();
    return snapshot.docs.map(doc => doc.data());
  }

  async getPredictionReport(executionId) {
    const docRef = this.db.collection('prediction_reports').doc(executionId);
    const doc = await docRef.get();
    return doc.exists ? doc.data() : null;
  }

  async savePredictionReport(executionId, reportData) {
    const docRef = this.db.collection('prediction_reports').doc(executionId);
    await docRef.set(reportData, { merge: true });
  }
}

exports.firestoreService = new FirestoreService();