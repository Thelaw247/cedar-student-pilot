import express from 'express';

// Minimal skeleton — Phase 2 step 1 of the Base44 -> Supabase/Render/Cloudflare
// migration. Purpose is ONLY to prove the GitHub -> Render deploy pipeline
// works mechanically. Real backend logic (credit gating, Stripe fulfillment,
// the 28 ported Base44 functions) gets built on top of this, not left here.
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cedar-server', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`cedar-server listening on port ${PORT}`);
});
