const functions = require('@google-cloud/functions-framework');
const { firestoreService } = require('./common/services/Firestore.service');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const firestore = firestoreService.firestore;

const initialCharacters = [
    { name: 'Cypher', goal: 1, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0, totalWins: 0 },
    { name: 'Morpheus', goal: 2, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0, totalWins: 0 },
    { name: 'Trinity', goal: 3, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0, totalWins: 0 },
    { name: 'Neo', goal: 4, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0, totalWins: 0 },
    { name: "L'Oracle", goal: 5, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0, totalWins: 0 }
];

/**
 * Archives the previous month's results and resets characters for the new month.
 */
async function archiveAndReset() {
    console.log(chalk.blue.bold('New month detected. Archiving previous month and resetting characters...'));

    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = (prevMonthDate.getMonth() + 1).toString().padStart(2, '0'); // Format MM
    const archiveDocId = `${year}-${month}`;

    console.log(`   -> Archiving results for ${archiveDocId}`);

    // 1. Get final state of characters from 'simulation_characters'
    const charactersRef = firestore.collection('simulation_characters');
    const charactersSnapshot = await charactersRef.get();

    if (charactersSnapshot.empty) {
        console.log(chalk.yellow('   -> Characters collection is empty. Nothing to archive.'));
    } else {
        const finalCharacters = charactersSnapshot.docs.map(doc => doc.data());

        // 2. Save this state to 'simulation_history'
        const historyRef = firestore.collection('simulation_history').doc(archiveDocId);
        await historyRef.set({
            month: archiveDocId,
            generatedAt: now.toISOString(),
            characters: finalCharacters
        });
        console.log(chalk.green(`   -> Successfully archived ${finalCharacters.length} characters to document: ${archiveDocId}`));
    }

    // 3. Reset characters in 'simulation_characters' to their initial state
    console.log('   -> Resetting characters for the new month...');
    const batch = firestore.batch();
    initialCharacters.forEach(char => {
        const docRef = charactersRef.doc(char.name);
        batch.set(docRef, char, { merge: false });
    });

    await batch.commit();
    console.log(chalk.green('   -> All characters have been reset in Firestore.'));
    console.log(chalk.green('Archiving and reset complete.'));
}


/**
 * Generates an HTML report from the character statistics.
 * @param {Map<string, object>} charactersMap - A map of character objects.
 * @returns {string} - The HTML report as a string.
 */
function generateHtmlReport(charactersMap) {
    const characters = Array.from(charactersMap.values());
    const date = new Date().toLocaleString();

    let rows = '';
    characters.forEach(char => {
        const performance = char.performance.toFixed(2);
        const bankroll = char.bankroll.toFixed(2);
        const performanceClass = char.performance > 0 ? 'positive' : (char.performance < 0 ? 'negative' : '');
        const performanceString = char.performance > 0 ? `+${performance}` : performance;

        rows += `
            <tr>
                <td>${char.name}</td>
                <td>${char.progress}/${char.goal}</td>
                <td>${bankroll}€</td>
                <td>${char.initialBankroll}€</td>
                <td class="${performanceClass}">${performanceString}€</td>
                <td>${char.totalWins}</td>
                <td>${char.losses}</td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Architect Simulator Report</title>
            <style>
                body { font-family: sans-serif; background-color: #121212; color: #E0E0E0; padding: 20px; }
                h1, h2 { color: #00FF41; }
                h2 { font-size: 1em; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #333; }
                th { background-color: #1A1A1A; }
                tr:nth-child(even) { background-color: #1C1C1C; }
                .positive { color: #00FF41; }
                .negative { color: #FF4136; }
            </style>
        </head>
        <body>
            <h1>Architect Simulator Report</h1>
            <h2>Generated on: ${date}</h2>
            <table>
                <thead>
                    <tr>
                        <th>Character</th>
                        <th>Progress</th>
                        <th>Bankroll</th>
                        <th>Initial Bankroll</th>
                        <th>Performance</th>
                        <th>Wins</th>
                        <th>Losses</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </body>
        </html>
    `;
}

/**
 * Recalculates the current month's character stats based on all completed tickets.
 */
async function recalculateCurrentMonthStats() {
    console.log(chalk.blue.bold('Recalculating stats for the current month...'));

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`   -> Processing tickets from ${startDateStr} to ${endDateStr}`);

    // 1. Get all tickets for the current month
    const ticketsRef = firestore.collection('tickets');
    const ticketsSnapshot = await ticketsRef
        .where('date', '>=', startDateStr)
        .where('date', '<=', endDateStr)
        .orderBy('date', 'asc') // Process chronologically
        .get();

    if (ticketsSnapshot.empty) {
        console.log(chalk.yellow(`   -> No tickets found for the current month. Nothing to calculate.`));
        return;
    }

    const allMonthTickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(chalk.green(`   -> Found ${allMonthTickets.length} tickets for the current month.`));

    console.log(chalk.blue.bold('\n--- Matchs du mois ---'));
    allMonthTickets.forEach(ticket => {
        if (ticket.bets && ticket.bets.length > 0) {
            ticket.bets.forEach(bet => {
                const homeTeam = bet.home_team?.name || 'N/A';
                const awayTeam = bet.away_team?.name || 'N/A';
                const market = bet.market || 'N/A';
                console.log(`- ${homeTeam} vs ${awayTeam} (Marché: ${market})`);
            });
        }
    });

    const oracleChoiceTickets = allMonthTickets.filter(t => t.title === "The Oracle's Choice");
    if (oracleChoiceTickets.length > 0) {
        console.log(chalk.magenta.bold('\n--- Le(s) Choix de l\'Oracle ---'));
        oracleChoiceTickets.forEach(ticket => {
            console.log(JSON.stringify(ticket, null, 2));
        });
    } else {
        console.log(chalk.yellow('\n--- Aucun ticket "Le Choix de l\'Oracle" trouvé pour ce mois. ---'));
    }



    // 2. Start with initial character state
    let characters = JSON.parse(JSON.stringify(initialCharacters)); // Deep copy
    const charactersMap = new Map(characters.map(c => [c.name, c]));

    // 3. Process each ticket chronologically
    const processedTickets = allMonthTickets.filter(t => (t.status === 'won' || t.status === 'lost') && t.title === "The Oracle's Choice");
    console.log(chalk.cyan(`
   -> Processing ${processedTickets.length} completed (won/lost) tickets...`));

    for (const ticket of processedTickets) {
        console.log(chalk.green(`\n   --- Applying Ticket ${ticket.id} (Date: ${ticket.date}, Status: ${ticket.status}, Odd: ${ticket.totalOdd.toFixed(2)}) ---`));
        
        charactersMap.forEach(char => {
            if (ticket.status === 'won') {
                const profit = (char.initialBankroll * ticket.totalOdd) - char.initialBankroll;
                char.performance += profit;
                char.bankroll += profit;
                char.progress++;
                char.totalWins++;

                if (char.progress >= char.goal) {
                    console.log(chalk.magenta(`      -> ${char.name} a atteint son objectif de ${char.goal} victoires! Le cycle recommence.`));
                    char.progress = 0;
                }
            } else if (ticket.status === 'lost') {
                const lossAmount = char.initialBankroll;
                char.performance -= lossAmount;
                char.bankroll -= lossAmount;
                char.progress = 0;
                char.losses++;
            }
        });

        console.log(chalk.blue('    --- Stats after ticket ---'));
        charactersMap.forEach(char => {
            const perfString = char.performance >= 0 ? `+${char.performance.toFixed(2)}` : char.performance.toFixed(2);
            console.log(chalk.white(`    - ${char.name} | Objectif: ${char.progress}/${char.goal} | Bankroll: ${char.bankroll.toFixed(2)} (Initial: ${char.initialBankroll}) | Performance: ${perfString} | Défaites: ${char.losses}`));
        });
    }

    // 4. Save the final state
    console.log(chalk.blue.bold('\n--- Final Character Stats for the Month ---'));
    const batch = firestore.batch();
    charactersMap.forEach(char => {
        const perfString = char.performance >= 0 ? `+${char.performance.toFixed(2)}` : char.performance.toFixed(2);
        console.log(chalk.white(`- ${char.name} | Objectif: ${char.progress}/${char.goal} | Bankroll: ${char.bankroll.toFixed(2)} (Initial: ${char.initialBankroll}) | Performance: ${perfString} | Défaites: ${char.losses}`));
        const docRef = firestore.collection('simulation_characters').doc(char.name);
        batch.set(docRef, char, { merge: true }); // Use set with merge to save the final state
    });

    await batch.commit();\n    console.log(chalk.green.bold(\'\\n--- Architect Simulator stats updated successfully in Firestore. ---\'));\n\n    // 5. Generate HTML report\n    const htmlReport = generateHtmlReport(charactersMap);\n    const reportPath = path.join(\'/home/user/the-oracle-project\', \'simulation_results.html\');\n    fs.writeFileSync(reportPath, htmlReport);\n    console.log(chalk.blue.bold(`\\n--- HTML report generated at ${reportPath} ---\`));\n}


functions.http('runArchitectSimulatorUpdate', async (req, res) => {
    console.log(chalk.cyan.bold('--- Architect Simulator Updater Job Started ---'));

    const today = new Date();
    const isFirstDayOfMonth = today.getDate() === 1;

    try {
        if (isFirstDayOfMonth) {
            // On the first day, we archive the previous month BEFORE recalculating the new month.
            await archiveAndReset();
        }
        
        // Recalculate the current month's stats every time.
        await recalculateCurrentMonthStats();

        console.log(chalk.cyan.bold('--- Architect Simulator Updater Job Finished Successfully ---'));
        res.status(200).send('Architect Simulator Updated Successfully.');

    } catch (error) {
        console.error(chalk.red.bold('An error occurred during the update process:'), error);
        res.status(500).send('Internal Server Error');
    }
});