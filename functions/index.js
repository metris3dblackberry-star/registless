// ─────────────────────────────────────────────────────────────────
// functions/index.js — Registless Firebase Cloud Functions v2
// firebase-functions v6 kompatibilis
// Registless 2026-03-22
// ─────────────────────────────────────────────────────────────────
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin  = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();

// ── Stripe inicializálás ──────────────────────────────────────────
const getStripe = () => {
  const key = process.env.STRIPE_SECRET;
  if (!key) throw new Error("STRIPE_SECRET nincs beállítva a .env fájlban!");
  return new Stripe(key, { apiVersion: "2024-04-10" });
};

// ── CORS helper ───────────────────────────────────────────────────
function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ─────────────────────────────────────────────────────────────────
// createStripeCheckout — Egyszeri fizetési link
// ─────────────────────────────────────────────────────────────────
exports.createStripeCheckout = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    try {
      const stripe = getStripe();
      const { amount, invoiceId, sellerName, contactName } = req.body;
      if (!amount || amount <= 0) { res.status(400).json({ error: "Érvénytelen összeg." }); return; }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "huf",
            product_data: {
              name: invoiceId || "Registless fizetés",
              description: `${sellerName || "Eladó"} → ${contactName || "Vevő"}`,
            },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        }],
        success_url: "https://registless.ai/payment-success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url:  "https://registless.ai/payment-cancel",
        metadata: { invoiceId: invoiceId || "", sellerName: sellerName || "" },
      });

      res.status(200).json({ url: session.url });
    } catch (e) {
      console.error("createStripeCheckout hiba:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// createStripeSubscription — PRO előfizetés link (18€/hó)
// ─────────────────────────────────────────────────────────────────
exports.createStripeSubscription = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    try {
      const stripe = getStripe();
      const { userId, userEmail } = req.body;
      if (!userId || !userEmail) { res.status(400).json({ error: "userId és userEmail szükséges." }); return; }

      // Customer keresés vagy létrehozás
      let customer;
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        customer = existing.data[0];
      } else {
        customer = await stripe.customers.create({ email: userEmail, metadata: { userId } });
      }

      const PRICE_ID = process.env.STRIPE_PRICE_ID;
      if (!PRICE_ID) throw new Error("STRIPE_PRICE_ID nincs beállítva!");

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        success_url: "https://registless.ai/pro-success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url:  "https://registless.ai/pro-cancel",
        metadata: { userId },
        subscription_data: { metadata: { userId } },
      });

      res.status(200).json({ url: session.url });
    } catch (e) {
      console.error("createStripeSubscription hiba:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// stripeWebhook — Stripe esemény fogadó
// ─────────────────────────────────────────────────────────────────
exports.stripeWebhook = onRequest(
  { region: "europe-west1", cors: false },
  async (req, res) => {
    const stripe        = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const db            = admin.firestore();

    let event;
    try {
      event = webhookSecret
        ? stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], webhookSecret)
        : req.body;
    } catch (e) {
      console.error("Webhook signature hiba:", e.message);
      res.status(400).send(`Webhook Error: ${e.message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId  = session.metadata?.userId;
          if (userId && session.mode === "subscription") {
            await db.collection("licenses").doc(userId).set({
              plan: "pro",
              stripeSubscriptionId: session.subscription,
              stripeCustomerId:     session.customer,
              proStartedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`PRO aktiválva: ${userId}`);
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub    = event.data.object;
          const userId = sub.metadata?.userId;
          if (userId) {
            await db.collection("licenses").doc(userId).set({
              plan:      "free",
              proEndsAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`PRO lemondva: ${userId}`);
          }
          break;
        }
        default:
          console.log(`Webhook esemény: ${event.type}`);
      }
      res.status(200).json({ received: true });
    } catch (e) {
      console.error("Webhook feldolgozási hiba:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// paymentReminder — Napi emlékeztető (09:00 Budapest)
// ─────────────────────────────────────────────────────────────────
exports.paymentReminder = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Europe/Budapest", region: "europe-west1" },
  async () => {
    const db        = admin.firestore();
    const messaging = admin.messaging();
    try {
      const usersSnap = await db.collection("users").get();
      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.pushToken) continue;
        const invoicesSnap = await db.collection("users").doc(userDoc.id)
          .collection("invoices").where("statusz", "!=", "PAID").limit(5).get();
        if (invoicesSnap.size > 0) {
          await messaging.send({
            token: user.pushToken,
            notification: { title: "💰 Nyitott számlád van!", body: `${invoicesSnap.size} db nyitott számla vár.` },
            data: { screen: "invoiceList" },
          }).catch((e) => console.log("Push hiba:", e.message));
        }
      }
    } catch (e) {
      console.error("paymentReminder hiba:", e.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// ocrAnalyze — Claude AI proxy az OCR elemzéshez
// ─────────────────────────────────────────────────────────────────
exports.ocrAnalyze = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    try {
      const { text, prompt } = req.body;
      if (!text && !prompt) { res.status(400).json({ error: "Szöveg szükséges." }); return; }

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY nincs beállítva." }); return; }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt || text }],
        }),
      });

      const data  = await response.json();
      const raw   = data?.content?.[0]?.text || "";
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        res.status(200).json(JSON.parse(clean));
      } catch {
        res.status(200).json({ raw });
      }
    } catch (e) {
      console.error("ocrAnalyze hiba:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// sendConfirmationEmail — Registless branded email megerősítés
// ─────────────────────────────────────────────────────────────────
exports.sendConfirmationEmail = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    try {
      const { email, name, confirmToken } = req.body;
      if (!email || !confirmToken) { res.status(400).json({ error: "Email és token szükséges." }); return; }

      const confirmUrl = `https://europe-west1-registless.cloudfunctions.net/confirmEmail?token=${confirmToken}&email=${encodeURIComponent(email)}`;

      const nodemailer  = require("nodemailer");
      const gmailUser   = process.env.GMAIL_USER;
      const gmailPass   = process.env.GMAIL_PASS;

      if (!gmailUser || !gmailPass) throw new Error("GMAIL_USER vagy GMAIL_PASS nincs beállítva!");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const htmlBody = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;margin:0;padding:0}
  .container{max-width:480px;margin:40px auto;background:#141414;border-radius:20px;overflow:hidden;border:1px solid rgba(255,122,26,0.3)}
  .header{background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);padding:40px 32px 32px;text-align:center;border-bottom:1px solid rgba(255,122,26,0.2)}
  .logo{font-size:28px;font-weight:900;color:#ff7a1a;letter-spacing:2px}
  .tagline{color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px;letter-spacing:1px}
  .body{padding:32px}
  .title{color:#fff;font-size:20px;font-weight:700;margin-bottom:12px}
  .text{color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin-bottom:28px}
  .btn{display:block;background:#ff7a1a;color:#fff;text-decoration:none;padding:16px 32px;border-radius:14px;text-align:center;font-size:16px;font-weight:700;margin-bottom:20px}
  .footer{color:rgba(255,255,255,0.3);font-size:12px;text-align:center;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06)}
</style></head>
<body><div class="container">
  <div class="header">
    <div class="logo">REGISTLESS</div>
    <div class="tagline">POWERED BY STAR LABS KFT.</div>
  </div>
  <div class="body">
    <div class="title">Üdv, ${name || email}! 👋</div>
    <div class="text">Köszönjük a regisztrációt! Egy kattintással megerősítheted az email címed és azonnal beléphetsz az appba.</div>
    <a href="${confirmUrl}" class="btn">✅ Email megerősítése & Belépés</a>
    <div class="text" style="font-size:13px;margin-bottom:0">Ha te nem regisztráltál a Registless appba, ezt az emailt figyelmen kívül hagyhatod.</div>
  </div>
  <div class="footer">Star Labs Kft. · registless.ai · Minden jog fenntartva</div>
</div></body></html>`;

      await transporter.sendMail({
        from:    `"Registless" <${gmailUser}>`,
        to:      email,
        subject: "✅ Erősítsd meg az email címed — Registless",
        html:    htmlBody,
        text:    `Erősítsd meg az email címed: ${confirmUrl}`,
      });

      await admin.firestore().collection("emailConfirms").doc(confirmToken).set({
        email, name: name || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmed: false,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ success: true });
    } catch (e) {
      console.error("sendConfirmationEmail hiba:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// confirmEmail — Token ellenőrzés
// ─────────────────────────────────────────────────────────────────
exports.confirmEmail = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res) => {
    const { token, email } = req.query;
    if (!token || !email) { res.status(400).send("Érvénytelen link."); return; }
    try {
      const doc = await admin.firestore().collection("emailConfirms").doc(token).get();
      if (!doc.exists || doc.data().email !== email) {
        res.status(400).send("Érvénytelen vagy lejárt megerősítő link.");
        return;
      }
      if (doc.data().expiresAt < Date.now()) {
        res.status(400).send("A megerősítő link lejárt. Kérj újat az appban.");
        return;
      }
      await doc.ref.update({ confirmed: true, confirmedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.redirect(`registless://confirm-success?email=${encodeURIComponent(email)}`);
    } catch (e) {
      res.status(500).send("Szerverhiba: " + e.message);
    }
  }
);
