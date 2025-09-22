const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin SDK if it hasn't been already.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * HTTP Cloud Function to get all "The Oracle's Choice" tickets for a given month.
 * The month is determined by the selectedDayOffset POST parameter.
 */
functions.http('getMonthlyOracleTickets', (req, res) => {
  // Handle CORS
  cors(req, res, async () => {
    try {
      // Default to 0 if no offset is provided
      const selectedDayOffset = req.body.data.selectedDayOffset || 0;

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + selectedDayOffset);

      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      lastDayOfMonth.setHours(23, 59, 59, 999);

      // Firestore query to get tickets for the month
      const ticketsSnapshot = await db.collection('tickets')
        .where('title', '==', "The Oracle's Choice")
        .where('date', '>=', firstDayOfMonth.toISOString().split('T')[0])
        .where('date', '<=', lastDayOfMonth.toISOString().split('T')[0])
        .get();

      const monthlyTickets = [];
      ticketsSnapshot.forEach(doc => {
        monthlyTickets.push({ id: doc.id, ...doc.data() });
      });

      // Sort by date ascending
      const sortedTickets = monthlyTickets.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.status(200).send({ data: sortedTickets });

    } catch (error) {
      console.error("Error in getMonthlyOracleTickets:", error);
      res.status(500).send({ data: { error: 'Internal Server Error' } });
    }
  });
});
