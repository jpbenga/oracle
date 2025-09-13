const functions = require('@google-cloud/functions-framework');
const chalk = require('chalk');
const { firestoreService } = require('./common/services/Firestore.service');

function getCombinations(array, size) {
    const result = [];
    function combination(temp, start) {
        if (temp.length === size) {
            result.push([...temp]);
            return;
        }
        for (let i = start; i < array.length; i++) {
            const current = array[i];
            if (current) {
                temp.push(current);
                combination(temp, i + 1);
                temp.pop();
            }
        }
    }
    combination([], 0);
    return result;
}

functions.http('runTicketGenerator', async (req, res) => {
    console.log(chalk.blue.bold("--- Démarrage du Job de Génération de Tickets ---"));

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayPredictions = await firestoreService.getEligiblePredictionsForDate(todayStr);
    const tomorrowPredictions = await firestoreService.getEligiblePredictionsForDate(tomorrowStr);

    const allEligiblePredictions = [...todayPredictions, ...tomorrowPredictions];

    if (allEligiblePredictions.length === 0) {
        console.log(chalk.yellow('Aucune prédiction éligible trouvée pour J et J+1. Aucun ticket ne sera généré.'));
        res.status(200).send("Aucune prédiction éligible.");
        return;
    }
    
    console.log(chalk.cyan(`${allEligiblePredictions.length} pronostics éligibles trouvés pour J et J+1.`));

    const MIN_ODD = 1.88;
    const MAX_ODD = 2.25;
    const allPossibleTickets = [];

    // Tickets avec 1 match
    for (const pred of allEligiblePredictions) {
        if (pred.odd >= MIN_ODD && pred.odd <= MAX_ODD) {
            allPossibleTickets.push({
                bets: [pred],
                totalOdd: pred.odd,
                totalExpectedValue: (pred.score / 100) * pred.odd
            });
        }
    }

    // Tickets avec 2 matchs
    const combosOfTwo = getCombinations(allEligiblePredictions, 2);
    for (const combo of combosOfTwo) {
        const totalOdd = combo.reduce((acc, p) => acc * (p.odd || 1), 1);
        if (totalOdd >= MIN_ODD && totalOdd <= MAX_ODD) {
            const totalExpectedValue = combo.reduce((acc, p) => acc + ((p.score / 100) * p.odd), 0);
            allPossibleTickets.push({
                bets: combo,
                totalOdd,
                totalExpectedValue,
            });
        }
    }

    if (allPossibleTickets.length === 0) {
        console.log(chalk.yellow("Aucun ticket n'a pu être généré avec les critères actuels."));
        res.status(200).send("Aucun ticket généré.");
        return;
    }

    const bestTickets = allPossibleTickets.sort((a, b) => b.totalExpectedValue - a.totalExpectedValue).slice(0, 3);
    
    await firestoreService.deletePendingTicketsForDate(todayStr);
    await firestoreService.deletePendingTicketsForDate(tomorrowStr);
    
    console.log(chalk.magenta.bold(`\n-> Sauvegarde de ${bestTickets.length} tickets dans Firestore...`));
    for (const ticket of bestTickets) {
        const ticketData = {
            title: "The Oracle's Choice", // Simplifié pour l'exemple, peut être adapté
            totalOdd: ticket.totalOdd,
            totalExpectedValue: ticket.totalExpectedValue,
            creation_date: new Date().toISOString().split('T')[0],
            status: 'PENDING',
            bets: ticket.bets, // Sauvegarde des objets bet complets
        };
        await firestoreService.saveTicket(ticketData);
    }
    console.log(chalk.green.bold(`-> ${bestTickets.length} tickets sauvegardés avec succès.`));
    
    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
    res.status(200).send("Génération de tickets terminée avec succès.");
});