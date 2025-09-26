const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const chalk = require('chalk');

const firestore = new Firestore();

const initialCharacters = [
    { name: 'Cypher', goal: 1, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Morpheus', goal: 2, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Trinity', goal: 3, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: 'Neo', goal: 4, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 },
    { name: "L'Oracle", goal: 5, bankroll: 20, initialBankroll: 20, progress: 0, losses: 0, performance: 0 }
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
        // Use set with merge:false to completely overwrite, ensuring a clean reset
        batch.set(docRef, char, { merge: false });
    });

    await batch.commit();
    console.log(chalk.green('   -> All characters have been reset in Firestore.'));
    console.log(chalk.green('Archiving and reset complete.'));
}

/**
 * Updates character stats based on the previous day's ticket result.
 */
async function updateDaily() {
    console.log(chalk.blue.bold('Daily update running...'));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // Format YYYY-MM-DD

    console.log(`   -> Searching for a ticket for date: ${yesterdayStr}`);

    // 1. Get a ticket for the previous day.
    const ticketsRef = firestore.collection('tickets');
    const ticketSnapshot = await ticketsRef
        .where('date', '==', yesterdayStr)
        .limit(1)
        .get();

    if (ticketSnapshot.empty) {
        console.log(chalk.yellow(`   -> No ticket found for ${yesterdayStr}. Skipping update.`));
        return;
    }

    const oracleTicket = ticketSnapshot.docs[0].data();
    console.log(`   -> Found ticket with status: ${oracleTicket.status}`);
    console.log(chalk.blue.bold('--- Ticket Found ---'));
    console.log(JSON.stringify(oracleTicket, null, 2));
    console.log(chalk.blue.bold('--- End of Ticket ---'));

    // Only proceed if the ticket is won or lost
    if (oracleTicket.status !== 'won' && oracleTicket.status !== 'lost') {
        console.log(chalk.yellow(`   -> Ticket status is '${oracleTicket.status}'. No action taken.`));
        return;
    }

    // 2. Get current character states from 'simulation_characters'.
    const charactersRef = firestore.collection('simulation_characters');
    const charactersSnapshot = await charactersRef.get();

    if (charactersSnapshot.empty) {
        console.log(chalk.yellow('   -> Character collection is empty. Seeding with initial data...'));
        const batch = firestore.batch();
        initialCharacters.forEach(char => {
            const docRef = charactersRef.doc(char.name);
            batch.set(docRef, char);
        });
        await batch.commit();
        console.log(chalk.green('   -> Characters seeded successfully.'));
        // Re-fetch the characters after seeding
        const newSnapshot = await charactersRef.get();
        await updateCharacters(newSnapshot, oracleTicket);
    } else {
        await updateCharacters(charactersSnapshot, oracleTicket);
    }

    console.log(chalk.green('Daily update complete.'));
}

/**
 * Helper function to apply win/loss logic and save updated characters.
 * @param {FirebaseFirestore.QuerySnapshot} charactersSnapshot
 * @param {object} oracleTicket
 */
async function updateCharacters(charactersSnapshot, oracleTicket) {
    const batch = firestore.batch();

    charactersSnapshot.forEach(doc => {
        const char = doc.data();
        console.log(`   -> Updating character: ${char.name}`);

        // 3. Apply the win/loss logic
        if (oracleTicket.status === 'won') {
            const newBankroll = char.bankroll * oracleTicket.totalOdd;
            const profit = newBankroll - char.bankroll;
            char.bankroll = newBankroll;
            char.progress++;
            char.performance += profit;

            // Check for goal completion
            if (char.progress >= char.goal) {
                char.bankroll = char.initialBankroll; // Reset bankroll
                char.progress = 0; // Reset progress
                console.log(chalk.magenta(`      --> ${char.name} reached their goal! Resetting.`));
            }
        } else if (oracleTicket.status === 'lost') {
            char.performance -= char.bankroll; // Subtract the bet amount from performance
            char.bankroll = char.initialBankroll; // Reset bankroll
            char.progress = 0; // Reset progress
            char.losses++;
            console.log(chalk.red(`      --> ${char.name} lost. Resetting.`));
        }

        // 4. Save the updated character back to Firestore
        const docRef = firestore.collection('simulation_characters').doc(doc.id);
        batch.update(docRef, char);
    });

    await batch.commit();
    console.log(chalk.green('   -> All characters have been updated in Firestore.'));
}

functions.http('runArchitectSimulatorUpdate', async (req, res) => {
    console.log(chalk.cyan.bold('--- Architect Simulator Updater Job Started ---'));

    const today = new Date();
    const isFirstDayOfMonth = today.getDate() === 1;

    try {
        if (isFirstDayOfMonth) {
            await archiveAndReset();
        }
        
        // The daily update should run every day, including the first day after the reset.
        await updateDaily();

        console.log(chalk.cyan.bold('--- Architect Simulator Updater Job Finished Successfully ---'));
        res.status(200).send('Architect Simulator Updated Successfully.');

    } catch (error) {
        console.error(chalk.red.bold('An error occurred during the update process:'), error);
        res.status(500).send('Internal Server Error');
    }
});
