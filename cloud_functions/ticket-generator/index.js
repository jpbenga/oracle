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

function calculateHistoricalQuality(perf) {
    const highTranches = ['70-79', '80-89', '90-100'];
    let success = 0, total = 0;
    highTranches.forEach(key => {
        const t = perf[key] || { success: 0, total: 0 };
        success += t.success;
        total += t.total;
    });
    if (total === 0) return 0;
    const rate = success / total;
    const volume_factor = Math.min(1, total / 50); // Asymptote à 1 quand total >=50 pour récompenser le volume
    return rate * volume_factor;
}

function calculatePredictionQuality(pred) {
    const confidence = pred.score / 100;
    const historicalQuality = calculateHistoricalQuality(pred.market_performance);
    return confidence * historicalQuality;
}

function generateTicketsHtml(tickets, sortedEligible) {
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
        .eligible-section { margin-top: 60px; }
        .eligible-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 30px; }
        .eligible-card { background-color: #1e1e1e; border: 1px solid #373737; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 20px; }
        .eligible-header { text-align: center; margin-bottom: 20px; }
        .eligible-header h3 { color: #bb86fc; }
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

    let eligibleHtml = '';
    if (sortedEligible.length > 0) {
        sortedEligible.forEach((pred, index) => {
            let perfTableHtml = `
                <table class="perf-table">
                    <thead><tr><th>Tranche</th><th>Réussite</th><th>Total</th><th>Taux</th></tr></thead>
                    <tbody>`;
            const perfData = pred.market_performance || {};
            const trancheKeys = ['0-59', '60-69', '70-79', '80-89', '90-100'];
            trancheKeys.forEach(key => {
                const tranche = perfData[key] || { success: 0, total: 0 };
                const rate = tranche.total > 0 ? (tranche.success / tranche.total * 100).toFixed(2) + '%' : '0.00%';
                perfTableHtml += `<tr><td>${key}%</td><td>${tranche.success}</td><td>${tranche.total}</td><td>${rate}</td></tr>`;
            });
            perfTableHtml += `</tbody></table>`;

            eligibleHtml += `
                <div class="eligible-card">
                    <div class="eligible-header"><h3>Pari Éligible #${index + 1} (Score de Perfection: ${(pred.quality * 100).toFixed(2)}%)</h3></div>
                    <div class="bet-match">
                        <img src="${pred.home_team.logo}" class="team-logo"> ${pred.home_team.name} vs <img src="${pred.away_team.logo}" class="team-logo" style="margin-left:8px;"> ${pred.away_team.name}
                    </div>
                    <div><small>${pred.league.name} - ${new Date(pred.matchDate).toLocaleString('fr-FR')}</small></div>
                    <div class="bet-market">
                        Pari: <strong>${pred.market} @ ${pred.odd.toFixed(2)}</strong> (${pred.bookmaker})
                    </div>
                    <div>Confiance: <strong>${pred.score.toFixed(2)}%</strong></div>
                    <details style="margin-top: 10px; cursor: pointer;">
                        <summary>Performance historique du marché</summary>
                        ${perfTableHtml}
                    </details>
                </div>
            `;
        });
    } else {
        eligibleHtml = '<div class="no-data"><p>Aucun pari éligible trouvé.</p></div>';
    }

    return `
        <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Tickets Générés</title><style>${css}</style></head>
        <body><div class="container"><h1>Top 3 des Tickets Générés</h1><div class="ticket-grid">${ticketsHtml}</div>
        <div class="eligible-section"><h1>Tous les Paris Éligibles (Classés par Perfection)</h1><div class="eligible-grid">${eligibleHtml}</div></div>
        </div></body></html>
    `;
}

function generateTicketsForDay(predictions) {
    console.log(`   -> [generateTicketsForDay] Démarrage avec ${predictions.length} prédictions.`);
    const MIN_ODD = 1.7;
    const MAX_ODD = 2.05;
    const MIN_QUALITY = 0.5; // Seuil minimal pour qu'un pronostic soit éligible (sur une échelle de 0-1)
    const MIN_CONFIDENCE = 70; // Confiance minimale en %
    let allPossibleTickets = [];

    if (predictions.length === 0) {
        return { allPossibleTickets, sortedEligible: [] };
    }

    let eligiblePredictions = predictions.filter(p => p.odd && p.market_performance && p.score >= MIN_CONFIDENCE);
    console.log(`   -> [generateTicketsForDay] ${eligiblePredictions.length} prédictions restantes après filtre (odd, market_performance, confidence >= ${MIN_CONFIDENCE}%).`);

    // Calculer la qualité pour chaque éligible et filtrer sur MIN_QUALITY
    eligiblePredictions.forEach(pred => {
        pred.quality = calculatePredictionQuality(pred);
    });
    eligiblePredictions = eligiblePredictions.filter(pred => pred.quality >= MIN_QUALITY);
    console.log(`   -> [generateTicketsForDay] ${eligiblePredictions.length} prédictions restantes après filtre sur qualité >= ${MIN_QUALITY}.`);

    // Trier les éligibles par quality desc pour l'affichage
    const sortedEligible = [...eligiblePredictions].sort((a, b) => b.quality - a.quality);

    for (const pred of eligiblePredictions) {
        if (pred.odd >= MIN_ODD && pred.odd <= MAX_ODD) {
            allPossibleTickets.push({
                bets: [pred],
                totalOdd: pred.odd,
                compositeScore: pred.odd * pred.quality // Pour simples: odd * quality
            });
        }
    }
    console.log(`   -> [generateTicketsForDay] ${allPossibleTickets.length} tickets simples créés (cote entre ${MIN_ODD} et ${MAX_ODD}).`);

    const MIN_ODD_FOR_COMBOS = 1.3;
    const predictionsForCombos = eligiblePredictions.filter(p => p.odd >= MIN_ODD_FOR_COMBOS);
    console.log(`   -> [generateTicketsForDay] ${predictionsForCombos.length} prédictions disponibles pour les combinés (cote >= ${MIN_ODD_FOR_COMBOS}).`);

    if (predictionsForCombos.length > 1) {
        const combosOfTwo = getCombinations(predictionsForCombos, 2);
        console.log(`   -> [generateTicketsForDay] ${combosOfTwo.length} combinaisons de 2 possibles.`);

        for (const combo of combosOfTwo) {
            if (combo[0].fixtureId === combo[1].fixtureId && combo[0].market === combo[1].market) continue;

            const totalOdd = combo.reduce((acc, p) => acc * p.odd, 1);
            if (totalOdd >= MIN_ODD && totalOdd <= MAX_ODD) {
                const avgQuality = combo.reduce((acc, p) => acc + p.quality, 0) / combo.length;
                const minQuality = Math.min(...combo.map(p => p.quality));
                const compositeScore = totalOdd * avgQuality * minQuality; // Pénalise si un bet faible
                allPossibleTickets.push({
                    bets: combo,
                    totalOdd,
                    compositeScore
                });
            }
        }
    }

    console.log(`   -> [generateTicketsForDay] Total de ${allPossibleTickets.length} tickets possibles trouvés (simples + combinés).`);
    return { allPossibleTickets, sortedEligible };
}

functions.http('runTicketGenerator', async (req, res) => {
    console.log(chalk.blue.bold("---Démarrage du Job de Génération de Tickets---"));

    let generatedTickets = [];
    let sortedEligible = [];
    let generatedForDate = null;

    // Boucle pour trouver le prochain jour sans tickets (J, J+1, J+2...)
    for (let i = 0; i < 7; i++) { // On cherche sur 7 jours max
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + i);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        console.log(chalk.cyan(`Vérification des tickets pour le ${targetDateStr}...`));

        const ticketsExist = await firestoreService.doTicketsExistForDate(targetDateStr);

        if (ticketsExist) {
            console.log(chalk.yellow(`   -> Des tickets existent déjà pour le ${targetDateStr}. Passage au jour suivant.`));
            continue; // Passe au jour suivant
        }

        // Si on arrive ici, c'est le bon jour pour générer les tickets
        console.log(chalk.green.bold(`Aucun ticket trouvé pour le ${targetDateStr}. Lancement de la génération...`));
        generatedForDate = targetDateStr;

        const predictions = await firestoreService.getEligiblePredictionsForDate(targetDateStr);

        if (predictions.length === 0) {
            console.log(chalk.yellow(`   -> Aucune prédiction éligible trouvée pour le ${targetDateStr}.`));
            // On ne break pas, peut-être qu'il y en a pour le jour d'après
            continue;
        }
        
        console.log(chalk.cyan(`   -> ${predictions.length} pronostics éligibles trouvés.`));
        
        const { allPossibleTickets, sortedEligible: daySortedEligible } = generateTicketsForDay(predictions);
        sortedEligible = daySortedEligible;
        
        if (allPossibleTickets.length === 0) {
            console.log(chalk.yellow("   -> Aucun ticket n'a pu être généré avec les critères actuels."));
            // On ne break pas, peut-être qu'il y en a pour le jour d'après
            continue;
        }

        let bestTickets = allPossibleTickets
            .sort((a, b) => b.compositeScore - a.compositeScore)
            .slice(0, 3)
            .map(ticket => ({ bets: ticket.bets, totalOdd: ticket.totalOdd })); // Retirer compositeScore pour sauvegarde
        
        console.log(chalk.magenta.bold(`   -> Sauvegarde de ${bestTickets.length} tickets dans Firestore...`));
        for (const ticket of bestTickets) {
            const ticketData = {
                title: "The Oracle's Choice",
                totalOdd: ticket.totalOdd,
                date: targetDateStr, // Utiliser la date cible
                status: 'PENDING',
                bets: ticket.bets
            };
            await firestoreService.saveTicket(ticketData);
        }
        
        generatedTickets = bestTickets;
        console.log(chalk.green.bold(`   -> ${generatedTickets.length} tickets sauvegardés avec succès pour le ${targetDateStr}.`));
        
        break; // On a généré les tickets, on sort de la boucle
    }

    if (generatedTickets.length === 0) {
        console.log(chalk.yellow.bold("\nAucun ticket n'a été généré sur la période de recherche."));
    }

    console.log(chalk.blue.bold("\n--- Job de Génération de Tickets Terminé ---"));
    res.status(200).send(generateTicketsHtml(generatedTickets, sortedEligible));
});