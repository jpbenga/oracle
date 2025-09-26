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
                let newStatus = 'won'; // Assume won until proven otherwise

                if (!ticket.bets || ticket.bets.length === 0) {
                    console.log(chalk.yellow(`      -> Ticket ${ticket.id} n'a aucun pari. Passage au suivant.`));
                    continue;
                }

                for (const bet of ticket.bets) {
                    // The `result` field is updated by the `results-checker` function
                    if (bet.result === 'LOST') {
                        newStatus = 'lost';
                        break; // If one bet is lost, the whole ticket is lost
                    }
                    if (bet.result === null || bet.result === undefined || bet.result === 'UNKNOWN') {
                        newStatus = 'PENDING';
                        break; // If any bet is not yet resolved, the ticket is still pending
                    }
                }

                if (ticket.status !== newStatus && newStatus !== 'PENDING') {
                    console.log(chalk.magenta.bold(`      -> Le statut du Ticket ${ticket.id} passe à : ${newStatus.toUpperCase()}`));
                    await firestoreService.updateTicketStatus(ticket.id, newStatus);
                    totalTicketsUpdated++;
                } else {
                    console.log(chalk.gray(`      -> Le statut du Ticket ${ticket.id} reste : ${ticket.status}`));
                }
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
