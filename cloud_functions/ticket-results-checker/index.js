const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');

functions.http('runTicketResultsChecker', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Vérification des Résultats de Tickets ---"));

    try {
        // Check for tickets from today and yesterday to cover all recent matches
        const datesToCheck = [
            new Date().toISOString().split('T')[0],
            new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]
        ];

        let totalTicketsUpdated = 0;

        for (const dateStr of datesToCheck) {
            console.log(chalk.cyan(`Vérification des tickets pour le ${dateStr}...`));
            const tickets = await firestoreService.getTicketsByDate(dateStr);

            if (tickets.length === 0) {
                console.log(chalk.gray(`   -> Aucun ticket trouvé pour le ${dateStr}.`));
                continue;
            }

            console.log(chalk.white(`   -> ${tickets.length} ticket(s) trouvé(s).`));

            for (const ticket of tickets) {
                console.log(chalk.blue(`   --- Traitement du Ticket ${ticket.id} (Statut actuel: ${ticket.status}) ---`));
                console.log(chalk.gray('--- Structure du Ticket ---'));
                console.log(JSON.stringify(ticket, null, 2));
                console.log(chalk.gray('--- Fin de la Structure ---'));
                let newStatus = 'won';
                let reason = 'Tous les paris sont gagnants.';

                if (!ticket.bets || ticket.bets.length === 0) {
                    console.log(chalk.yellow(`      -> Le ticket n'a aucun pari.`));
                    console.log(chalk.blue(`   --- Fin du traitement du Ticket ${ticket.id} ---`));
                    continue;
                }

                const predictionIds = ticket.bets.map(b => b.id).filter(id => id);
                if (predictionIds.length === 0) {
                    console.log(chalk.yellow(`      -> Impossible de trouver les IDs des paris pour ce ticket.`));
                    console.log(chalk.blue(`   --- Fin du traitement du Ticket ${ticket.id} ---`));
                    continue;
                }

                const latestPredictions = await firestoreService.getPredictionsByIds(predictionIds);
                const latestPredictionsMap = new Map(latestPredictions.map(p => [p.id, p]));

                for (const bet of ticket.bets) {
                    const latestPrediction = latestPredictionsMap.get(bet.id);
                    const latestResult = latestPrediction ? latestPrediction.result : 'UNKNOWN';

                    const betInfo = `${bet.home_team?.name || 'Equipe Inconnue'} vs ${bet.away_team?.name || 'Equipe Inconnue'} - ${bet.market}`;
                    console.log(chalk.white(`      - Pari: ${betInfo}, Résultat du ticket: ${bet.result || 'NON DISPONIBLE'}, Résultat à jour: ${latestResult || 'NON DISPONIBLE'}`));

                    if (latestResult === 'LOST') {
                        newStatus = 'lost';
                        reason = `Le pari "${betInfo}" est perdant.`;
                        break;
                    }
                    if (latestResult === null || latestResult === undefined || latestResult === 'UNKNOWN') {
                        newStatus = 'PENDING';
                        reason = `Le résultat à jour du pari "${betInfo}" n'est pas encore disponible.`;
                        break;
                    }
                }

                if (ticket.status !== newStatus && newStatus !== 'PENDING') {
                    console.log(chalk.magenta.bold(`      -> Le statut du Ticket ${ticket.id} passe de ${ticket.status} à : ${newStatus.toUpperCase()}.`));
                    await firestoreService.updateTicketStatus(ticket.id, newStatus);
                    totalTicketsUpdated++;
                } else {
                    console.log(chalk.gray(`      -> Le statut du Ticket ${ticket.id} reste : ${ticket.status}. Raison: ${reason}`));
                }
                console.log(chalk.blue(`   --- Fin du traitement du Ticket ${ticket.id} ---`));
            }
        }

        const successMsg = `Vérification des tickets terminée. ${totalTicketsUpdated} ticket(s) mis à jour.`;
        console.log(chalk.green.bold(`
--- ${successMsg} ---`));
        res.status(200).send(successMsg);

    } catch (error) {
        console.error(chalk.red.bold('Une erreur est survenue durant la vérification des tickets:'), error);
        res.status(500).send('Internal Server Error');
    }
});
