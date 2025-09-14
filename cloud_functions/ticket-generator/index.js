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

function generateTicketsHtml(tickets) {
    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: auto; }
        h1 { color: #bb86fc; border-bottom: 2px solid #373737; padding-bottom: 10px; font-size: 2em; text-align: center; margin-bottom: 40px; }
        .ticket-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; }
        .ticket-card { background-color: #1e1e1e; border: 1px solid #373737; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s; }
        .ticket-card:hover { transform: translateY(-5px); }
        .ticket-header { background-color: #333; color: #fff; padding: 15px; text-align: center; }
        .ticket-header h2 { margin: 0; font-size: 1.2em; }
        .ticket-body { padding: 20px; flex-grow: 1; }
        .ticket-footer { background-color: #2a2a2a; padding: 15px; text-align: center; border-top: 1px solid #373737; }
        .ticket-footer strong { font-size: 1.4em; color: #03dac6; }
        .bet { border-bottom: 1px solid #373737; padding: 15px 0; }
        .bet:last-child { border-bottom: none; }
        .bet-match { font-weight: bold; color: #e0e0e0; }
        .bet-market { color: #aaa; font-size: 0.9em; }
        .bet-details { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px; margin-top: 8px; font-size: 0.9em; }
        .bet-odd { font-weight: bold; color: #e0e0e0; text-align: right;}
        .no-data { text-align: center; padding: 40px; font-style: italic; color: #888; background: #1e1e1e; border-radius: 8px; }
    `;

    let ticketsHtml = '';
    if (tickets.length > 0) {
        tickets.forEach((ticket, index) => {
            let betsHtml = '';
            ticket.bets.forEach(bet => {
                betsHtml += `
                    <div class="bet">
                        <div class="bet-match">${bet.matchLabel}</div>
                        <div class="bet-market">${bet.market}</div>
                        <div class="bet-details">
                            <span>Confiance:</span> <span class="bet-odd">${bet.score.toFixed(2)}%</span>
                            <span>Perf. Marché:</span> <span class="bet-odd">${bet.historicalRate ? bet.historicalRate.toFixed(2) + '%' : 'N/A'}</span>
                            <span>Cote:</span> <span class="bet-odd">${bet.odd}</span>
                        </div>
                    </div>
                `;
            });

            ticketsHtml += `
                <div class="ticket-card">
                    <div class="ticket-header">
                        <h2>Ticket #${index + 1}</h2>
                    </div>
                    <div class="ticket-body">
                        ${betsHtml}
                    </div>
                    <div class="ticket-footer">
                        <div>Cote Totale : <strong>${ticket.totalOdd.toFixed(2)}</strong></div>
                        <div style="font-size: 0.8em; margin-top: 5px;">Valeur Attendue (VE): ${ticket.totalExpectedValue.toFixed(3)}</div>
                    </div>
                </div>
            `;
        });
    } else {
        ticketsHtml = '<div class="no-data"><p>Aucun ticket n\'a pu être généré avec les critères actuels.</p></div>';
    }

    return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Tickets Générés</title>
            <style>${css}</style>
        </head>
        <body>
            <div class="container">
                <h1>Top 3 des Tickets Générés</h1>
                <div class="ticket-grid">
                    ${ticketsHtml}
                </div>
            </div>
        </body>
        </html>
    `;
}

functions.http('runTicketGenerator', async (req, res) => {
    console.log(chalk.blue.bold("---" + "Démarrage du Job de Génération de Tickets" + "---"));

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayPredictions = await firestoreService.getEligiblePredictionsForDate(todayStr);
    const tomorrowPredictions = await firestoreService.getEligiblePredictionsForDate(tomorrowStr);

    let allEligiblePredictions = [...todayPredictions, ...tomorrowPredictions].filter(p => p.odd && p.historicalRate);

    if (allEligiblePredictions.length === 0) {
        console.log(chalk.yellow('Aucune prédiction éligible avec cote et score historique trouvée pour J et J+1.'));
        res.status(200).send(generateTicketsHtml([]));
        return;
    }
    
    allEligiblePredictions.forEach(p => {
        p.weightedScore = (p.score + p.historicalRate) / 2;
    });

    console.log(chalk.cyan(`${allEligiblePredictions.length} pronostics éligibles trouvés pour J et J+1.`));

    const MIN_ODD = 1.88;
    const MAX_ODD = 2.25;
    let allPossibleTickets = [];

    for (const pred of allEligiblePredictions) {
        if (pred.odd >= MIN_ODD && pred.odd <= MAX_ODD) {
            allPossibleTickets.push({
                bets: [pred],
                totalOdd: pred.odd,
                totalExpectedValue: (pred.weightedScore / 100) * pred.odd
            });
        }
    }

    const MIN_ODD_FOR_COMBOS = 1.35;
    const predictionsForCombos = allEligiblePredictions.filter(p => p.odd >= MIN_ODD_FOR_COMBOS);
    console.log(chalk.cyan(`   -> ${predictionsForCombos.length} pronostics conservés pour les combinés (cote >= ${MIN_ODD_FOR_COMBOS})`));

    if (predictionsForCombos.length > 1) {
        const combosOfTwo = getCombinations(predictionsForCombos, 2);
        console.log(chalk.cyan(`   -> Calcul sur ${combosOfTwo.length} combinaisons possibles...`));

        for (const combo of combosOfTwo) {
            if (combo[0].fixtureId === combo[1].fixtureId) continue;

            const totalOdd = combo.reduce((acc, p) => acc * p.odd, 1);
            if (totalOdd >= MIN_ODD && totalOdd <= MAX_ODD) {
                const totalWeightedEV = combo.reduce((acc, p) => acc + ((p.weightedScore / 100) * p.odd), 0);
                allPossibleTickets.push({
                    bets: combo,
                    totalOdd,
                    totalExpectedValue: totalWeightedEV,
                });
            }
        }
    }

    if (allPossibleTickets.length === 0) {
        console.log(chalk.yellow("Aucun ticket n'a pu être généré avec les critères actuels."));
        res.status(200).send(generateTicketsHtml([]));
        return;
    }

    // --- NOUVELLE LOGIQUE DE SÉLECTION DE TICKETS UNIQUES ---
    let bestTickets = [];
    let remainingPossibleTickets = allPossibleTickets.sort((a, b) => b.totalExpectedValue - a.totalExpectedValue);

    while (bestTickets.length < 3 && remainingPossibleTickets.length > 0) {
        const bestTicket = remainingPossibleTickets[0];
        bestTickets.push(bestTicket);
        const usedFixtureIds = bestTicket.bets.map(bet => bet.fixtureId);
        remainingPossibleTickets = remainingPossibleTickets.filter(ticket => 
            !ticket.bets.some(bet => usedFixtureIds.includes(bet.fixtureId))
        );
    }
    // --- FIN DE LA NOUVELLE LOGIQUE ---
    
    await firestoreService.deletePendingTicketsForDate(todayStr);
    await firestoreService.deletePendingTicketsForDate(tomorrowStr);
    
    console.log(chalk.magenta.bold(`\n-> Sauvegarde de ${bestTickets.length} tickets dans Firestore...`));
    for (const ticket of bestTickets) {
        const ticketData = {
            title: "The Oracle's Choice",
            totalOdd: ticket.totalOdd,
            totalExpectedValue: ticket.totalExpectedValue,
            creation_date: new Date().toISOString().split('T')[0],
            status: 'PENDING',
            bets: ticket.bets.map(b => ({...b, weightedScore: undefined})) // Ne pas sauvegarder le score pondéré
        };
        await firestoreService.saveTicket(ticketData);
    }
    console.log(chalk.green.bold(`-> ${bestTickets.length} tickets sauvegardés avec succès.`));
    
    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
    res.status(200).send(generateTicketsHtml(bestTickets));
});