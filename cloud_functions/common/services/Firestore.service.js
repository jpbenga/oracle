const { Firestore } = require('@google-cloud/firestore');

class FirestoreService {
    constructor() {
        this.firestore = new Firestore({ projectId: 'oracle-prediction-firebase' });
        this.backtestCollection = this.firestore.collection('backtest_runs');
        this.predictionsCollection = this.firestore.collection('predictions');
        this.ticketsCollection = this.firestore.collection('tickets');
        this.predictionRunsCollection = this.firestore.collection('prediction_runs');
    }

    async testConnection() {
        try {
            await this.firestore.listCollections();
            console.log("Firestore connection successful.");
            return true;
        } catch (error) {
            console.error("Firestore connection failed:", error);
            return false;
        }
    }

    async saveBacktestRun(executionId, data) {
        const timestampedData = { ...data, createdAt: new Date() };
        return this.backtestCollection.doc(executionId).set(timestampedData, { merge: true });
    }

    async getLatestBacktestRun() {
        const snapshot = await this.backtestCollection.orderBy('createdAt', 'desc').limit(1).get();
        if (snapshot.empty) {
            return null;
        }
        const doc = snapshot.docs[0];
        return { executionId: doc.id, ...doc.data() };
    }
    
    async savePrediction(predictionData) {
        const uniqueId = `${predictionData.fixtureId}-${predictionData.market}`;
        return this.predictionsCollection.doc(uniqueId).set(predictionData, { merge: true });
    }

    async getEligiblePredictionsForDate(dateStr) {
        const startDate = new Date(`${dateStr}T00:00:00.000Z`);
        const endDate = new Date(`${dateStr}T23:59:59.999Z`);

        const snapshot = await this.predictionsCollection
            .where('matchDate', '>=', startDate.toISOString())
            .where('matchDate', '<=', endDate.toISOString())
            .where('status', '==', 'ELIGIBLE')
            .get();
        
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getPredictionsFromDateRange(startDate, endDate) {
        const snapshot = await this.predictionsCollection
            .where('matchDate', '>=', startDate.toISOString())
            .where('matchDate', '<=', endDate.toISOString())
            .get();
        
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    async saveTicket(ticketData) {
        return this.ticketsCollection.add(ticketData);
    }

    async getPendingOracleTickets(dateStr) {
        const snapshot = await this.ticketsCollection
            .where('date', '==', dateStr)
            .where('title', '==', "The Oracle's Choice")
            .where('status', '==', 'PENDING')
            .get();
        
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async updateTicketStatus(ticketId, status) {
        return this.ticketsCollection.doc(ticketId).update({ status });
    }

    async deletePendingTicketsForDate(dateStr) {
        const snapshot = await this.ticketsCollection
            .where('creation_date', '==', dateStr)
            .where('status', '==', 'PENDING')
            .get();

        if (snapshot.empty) {
            return;
        }
        
        const batch = this.firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        return batch.commit();
    }
    
    async savePredictionRun(runId, data) {
        return this.predictionRunsCollection.doc(runId).set(data, { merge: true });
    }

    async getPendingPredictions() {
        const snapshot = await this.predictionsCollection
            .where('result', '==', null)
            .get();
        
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async updatePredictionStatus(predictionId, data) {
        return this.predictionsCollection.doc(predictionId).update(data);
    }

    async batchUpdatePredictionResults(updates) {
        if (!updates || updates.length === 0) {
            return;
        }
        const batch = this.firestore.batch();
        updates.forEach(update => {
            const docRef = this.predictionsCollection.doc(update.predictionId);
            batch.update(docRef, { result: update.result, status: 'COMPLETED' });
        });
        return batch.commit();
    }
}

module.exports = {
    firestoreService: new FirestoreService(),
};