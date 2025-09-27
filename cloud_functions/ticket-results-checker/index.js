const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const chalk = require('chalk');

const firestore = new Firestore();

functions.http('runTicketResultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Tickets (Logique Mensuelle Stricte) ---"));

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(chalk.white(`   -> Période de traitement : du ${startDateStr} au ${endDateStr}`));

    try {
        const ticketsSnapshot = await firestore.collection('tickets')
            .where('date', '>=', startDateStr)
            .where('date', '<=', endDateStr)
            .get();

        const allMonthTickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(chalk.cyan(`   -> ${allMonthTickets.length} ticket(s) trouvés pour le mois.`));

        const predictionsSnapshot = await firestore.collection('predictions')
            .where('matchDate', '>=', startDate.toISOString())
            .where('matchDate', '<=', endDate.toISOString())
            .get();

        const allMonthPredictions = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(chalk.cyan(`   -> ${allMonthPredictions.length} prédiction(s) trouvée(s) pour le mois.`));

        const resultsMap = new Map(allMonthPredictions.map(p => [p.id, p.result]));
        const ticketsToUpdate = [];

        for (const ticket of allMonthTickets) {
            if (ticket.status === 'PENDING') {
                let allBetsResolved = true;
                let isLost = false;
                let needsUpdate = false;

                for (const bet of ticket.bets) {
                    const newResult = resultsMap.get(bet.id);
                    if (newResult && newResult !== bet.result) {
                        bet.result = newResult;
                        needsUpdate = true;
                    }
                    if (bet.result === 'LOST') {
                        isLost = true;
                    }
                    if (!bet.result || bet.result === 'UNKNOWN' || bet.result === null) {
                        allBetsResolved = false;
                    }
                }

                if (needsUpdate) {
                    const originalStatus = ticket.status;
                    if (isLost) {
                        ticket.status = 'lost';
                    } else if (allBetsResolved) {
                        ticket.status = 'won';
                    }
                    
                    if (ticket.status !== originalStatus) {
                         ticketsToUpdate.push(ticket);
                    }
                }
            }
        }
        
        if (ticketsToUpdate.length > 0) {
            console.log(chalk.magenta(`   -> ${ticketsToUpdate.length} ticket(s) à mettre à jour.`));
            const batch = firestore.batch();
            ticketsToUpdate.forEach(ticket => {
                const docRef = firestore.collection('tickets').doc(ticket.id);
                batch.update(docRef, { status: ticket.status, bets: ticket.bets });
            });
            await batch.commit();
            console.log(chalk.green('   -> Mise à jour des tickets terminée.'));
        } else {
            console.log(chalk.gray('   -> Aucun ticket à mettre à jour.'));
        }

        console.log(chalk.green.bold("--- Job terminé avec succès. ---"));
        res.status(200).send("Mise à jour des tickets terminée selon la logique mensuelle stricte.");

    } catch (error) {
        console.error(chalk.red.bold("Une erreur est survenue:"), error);
        res.status(500).send("Erreur interne du serveur.");
    }
});