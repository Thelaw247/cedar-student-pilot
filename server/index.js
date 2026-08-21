import express from 'express';
import stripeWebhookRouter from './routes/stripeWebhook.js';

const app = express();
const PORT = process.env.PORT || 3000;

// MUST be mounted with express.raw(), before any express.json() middleware
// on this path — Stripe signature verification needs the exact raw request
// bytes. Parsing to JSON first (even to re-stringify) can change whitespace
// and break the signature.
app.use('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cedar-server', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`cedar-server listening on port ${PORT}`);
});
