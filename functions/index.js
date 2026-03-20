"use strict";

const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions/v2");
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const Stripe = require("stripe");

setGlobalOptions({region: "europe-west1"});

if (getApps().length === 0) initializeApp();

exports.createStripeCheckout = onRequest(
    {
        cors: true,
        secrets: ["STRIPE_SECRET_KEY"],
    },
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({error: "Method not allowed"});
            return;
        }
        try {
            const {amount, invoiceId, sellerName, contactName} = req.body;
            if (!amount || amount <= 0) {
                res.status(400).json({error: "Ervénytelen összeg"});
                return;
            }
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                currency: "huf",
                line_items: [
                    {
                        price_data: {
                            currency: "huf",
                            unit_amount: Math.round(amount) * 100,
                            product_data: {
                                name: invoiceId ?
                                    `Szamla: ${invoiceId}` :
                                    // eslint-disable-next-line max-len
                                    `Fizetesi keres - ${sellerName || "Registless"}`,
                                description: contactName ?
                                    `Fizeto fel: ${contactName}` :
                                    undefined,
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://registless.ai/payment-success",
                cancel_url: "https://registless.ai/payment-cancel",
                metadata: {
                    invoiceId: invoiceId || "",
                    sellerName: sellerName || "",
                    contactName: contactName || "",
                    source: "registless-app",
                },
            });
            res.status(200).json({url: session.url});
        } catch (err) {
            console.error("Stripe error:", err);
            res.status(500).json({error: err.message});
        }
    }
);

// ── Stripe Subscription létrehozás ───────────────────────────────
exports.createStripeSubscription = onRequest(
    {
        cors: true,
        secrets: ["STRIPE_SECRET_KEY"],
    },
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({error: "Method not allowed"});
            return;
        }
        try {
            const {userId, userEmail} = req.body;
            if (!userId || !userEmail) {
                res.status(400).json({error: "userId és userEmail kötelező"});
                return;
            }
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

            // Stripe customer létrehozás vagy lekérés
            const customers = await stripe.customers.list({email: userEmail, limit: 1});
            let customer;
            if (customers.data.length > 0) {
                customer = customers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: userEmail,
                    metadata: {userId},
                });
            }

            // Checkout session subscription módban
            const session = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer: customer.id,
                line_items: [
                    {
                        price_data: {
                            currency: "eur",
                            unit_amount: 2500, // 25€ centben
                            recurring: {interval: "month"},
                            product_data: {
                                name: "Registless PRO",
                                description: "Korlátlan eladó mód, push értesítések, NFC",
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://registless.ai/pro-success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url: "https://registless.ai/pro-cancel",
                metadata: {userId},
            });

            res.status(200).json({url: session.url});
        } catch (err) {
            console.error("Stripe subscription error:", err);
            res.status(500).json({error: err.message});
        }
    }
);

// ── Stripe Webhook — előfizetés aktiválás ─────────────────────────
exports.stripeWebhook = onRequest(
    {cors: false, secrets: ["STRIPE_SECRET_KEY"]},
    async (req, res) => {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const sig = req.headers["stripe-signature"];

        try {
            const event = stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET || ""
            );

            if (event.type === "customer.subscription.created" ||
                event.type === "customer.subscription.updated") {
                const sub = event.data.object;
                const userId = sub.metadata?.userId;
                if (userId) {
                    const db = getFirestore();
                    await db.collection("licenses").doc(userId).set({
                        plan: "pro",
                        stripeSubscriptionId: sub.id,
                        proStartedAt: Date.now(),
                        proEndsAt: sub.current_period_end * 1000,
                        updatedAt: new Date(),
                    }, {merge: true});
                }
            }

            if (event.type === "customer.subscription.deleted") {
                const sub = event.data.object;
                const userId = sub.metadata?.userId;
                if (userId) {
                    const db = getFirestore();
                    await db.collection("licenses").doc(userId).set({
                        plan: "trial",
                        stripeSubscriptionId: null,
                        updatedAt: new Date(),
                    }, {merge: true});
                }
            }

            res.status(200).json({received: true});
        } catch (err) {
            console.error("Webhook error:", err);
            res.status(400).json({error: err.message});
        }
    }
);
exports.paymentReminder = onSchedule(
    {
        schedule: "every 72 hours",
        region: "europe-west1",
    },
    async () => {
        const db = getFirestore();
        const usersSnap = await db.collection("users").get();

        for (const userDoc of usersSnap.docs) {
            const user = userDoc.data();
            if (!user.pushToken) continue;

            // Keressük a nyitott számlákat
            const contactsSnap = await db
                .collection("users")
                .doc(userDoc.id)
                .collection("openItems")
                .get();

            if (contactsSnap.empty) continue;

            // Expo Push API
            await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    to: user.pushToken,
                    title: "💰 Nyitott tételek emlékeztető",
                    body: "Van néhány kifizetetlen számlád. Küldj fizetési kérést!",
                    data: {screen: "invoiceList"},
                    sound: "default",
                }),
            });
        }
    }
);
