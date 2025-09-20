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
        .ticket-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 30px; }
        .ticket-card { background-color: #1e1e1e; border: 1px solid #373737; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; }
        .ticket-header { background-color: #333; color: #fff; padding: 15px; text-align: center; }
        .ticket-header h2 { margin: 0; font-size: 1.2em; }
        .ticket-body { padding: 20px; flex-grow: 1; }
        .ticket-footer { background-color: #2a2a2a; padding: 15px; text-align: center; border-top: 1px solid #373737; }
        .ticket-footer strong { font-size: 1.4em; color: #03dac6; }
        .bet { border-bottom: 1px solid #373737; padding: 15px 0; }
        .bet:last-child { border-bottom: none; }
        .bet-match { font-weight: bold; color: #e0e0e0; display: flex; align-items: center; margin-bottom: 5px; }
        .team-logo { width: 20px; height: 20px; margin-right: 8px; }
        .bet-market { font-size: 1.1em; margin-top: 10px; }
        .perf-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; }
        .perf-table th, .perf-table td { padding: 8px; text-align: left; border: 1px solid #373737; }
        .perf-table th { background-color: #2a2a2a; }
        .no-data { text-align: center; padding: 40px; font-style: italic; color: #888; background: #1e1e1e; border-radius: 8px; }
    `;

    let ticketsHtml = '';
    if (tickets.length > 0) {
        tickets.forEach((ticket, index) => {
            let betsHtml = '';
            ticket.bets.forEach(bet => {
                let perfTableHtml = `
                    <table class="perf-table">
                        <thead><tr><th>Tranche</th><th>Réussite</th><th>Total</th><th>Taux</th></tr></thead>
                        <tbody>`;
                const perfData = bet.market_performance || {};
                const trancheKeys = ['0-59', '60-69', '70-79', '80-89', '90-100'];
                trancheKeys.forEach(key => {
                    const tranche = perfData[key] || { success: 0, total: 0 };
                    const rate = tranche.total > 0 ? (tranche.success / tranche.total * 100).toFixed(2) + '%' : '0.00%';
                    perfTableHtml += `<tr><td>${key}%</td><td>${tranche.success}</td><td>${tranche.total}</td><td>${rate}</td></tr>`;
                });
                perfTableHtml += `</tbody></table>`;

                betsHtml += `
                    <div class="bet">
                        <div class="bet-match">
                            <img src="${bet.home_team.logo}" class="team-logo"> ${bet.home_team.name} vs <img src="${bet.away_team.logo}" class="team-logo" style="margin-left:8px;"> ${bet.away_team.name}
                        </div>
                        <div><small>${bet.league.name} - ${new Date(bet.matchDate).toLocaleString('fr-FR')}</small></div>
                        <div class="bet-market">
                            Pari: <strong>${bet.market} @ ${bet.odd.toFixed(2)}</strong> (${bet.bookmaker})
                        </div>
                        <div>Confiance: <strong>${bet.score.toFixed(2)}%</strong></div>
                        <details style="margin-top: 10px; cursor: pointer;">
                            <summary>Performance historique du marché</summary>
                            ${perfTableHtml}
                        </details>
                    </div>
                `;
            });

            ticketsHtml += `
                <div class="ticket-card">
                    <div class="ticket-header"><h2>Ticket #${index + 1}</h2></div>
                    <div class="ticket-body">${betsHtml}</div>
                    <div class="ticket-footer">
                        <div>Cote Totale : <strong>${ticket.totalOdd.toFixed(2)}</strong></div>
                    </div>
                </div>
            `;
        });
    } else {
        ticketsHtml = '<div class="no-data"><p>Aucun ticket n\'a pu être généré avec les critères actuels.</p></div>';
    }

    return `
        <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Tickets Générés</title><style>${css}</style></head>
        <body><div class="container"><h1>Top 3 des Tickets Générés</h1><div class="ticket-grid">${ticketsHtml}</div></div></body></html>
    `;
}


function generateTicketsForDay(predictions) {
    const MIN_ODD = 1.88;
    const MAX_ODD = 2.25;
    let allPossibleTickets = [];

    if (predictions.length === 0) {
        return allPossibleTickets;
    }

    const eligiblePredictions = predictions.filter(p => p.odd && p.market_performance);

    for (const pred of eligiblePredictions) {
        if (pred.odd >= MIN_ODD && pred.odd <= MAX_ODD) {
            allPossibleTickets.push({
                bets: [pred],
                totalOdd: pred.odd
            });
        }
    }

    const MIN_ODD_FOR_COMBOS = 1.35;
    const predictionsForCombos = eligiblePredictions.filter(p => p.odd >= MIN_ODD_FOR_COMBOS);

    if (predictionsForCombos.length > 1) {
        const combosOfTwo = getCombinations(predictionsForCombos, 2);

        for (const combo of combosOfTwo) {
            if (combo[0].fixtureId === combo[1].fixtureId) continue;

            const totalOdd = combo.reduce((acc, p) => acc * p.odd, 1);
            if (totalOdd >= MIN_ODD && totalOdd <= MAX_ODD) {
                allPossibleTickets.push({
                    bets: combo,
                    totalOdd
                });
            }
        }
    }

    return allPossibleTickets;
}

functions.http('ticket-generator', async (req, res) => {
    console.log(chalk.blue.bold("---Démarrage du Job de Génération de Tickets---"));

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayPredictions = await firestoreService.getEligiblePredictionsForDate(todayStr);
    const tomorrowPredictions = await firestoreService.getEligiblePredictionsForDate(tomorrowStr);
    
    const allPredictions = [...todayPredictions, ...tomorrowPredictions];

    if (allPredictions.length === 0) {
        console.log(chalk.yellow('Aucune prédiction éligible trouvée pour J et J+1.'));
        res.status(200).send(generateTicketsHtml([]));
        return;
    }
    
    console.log(chalk.cyan(`${allPredictions.length} pronostics éligibles trouvés pour J et J+1.`));
    
    const allPossibleTickets = generateTicketsForDay(allPredictions);
    
    if (allPossibleTickets.length === 0) {
        console.log(chalk.yellow("Aucun ticket n'a pu être généré avec les critères actuels."));
        res.status(200).send(generateTicketsHtml([]));
        return;
    }

    let bestTickets = allPossibleTickets
        .sort((a, b) => b.totalOdd - a.totalOdd)
        .slice(0, 3);
    
    await firestoreService.deletePendingTicketsForDate(todayStr);
    await firestoreService.deletePendingTicketsForDate(tomorrowStr);
    
    console.log(chalk.magenta.bold(`\n-> Sauvegarde de ${bestTickets.length} tickets dans Firestore...`));
    for (const ticket of bestTickets) {
        const ticketData = {
            title: "The Oracle's Choice",
            totalOdd: ticket.totalOdd,
            creation_date: new Date().toISOString().split('T')[0],
            status: 'PENDING',
            bets: ticket.bets
        };
        await firestoreService.saveTicket(ticketData);
    }
    console.log(chalk.green.bold(`-> ${bestTickets.length} tickets sauvegardés avec succès.`));
    
    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
    res.status(200).send(generateTicketsHtml(bestTickets));
});