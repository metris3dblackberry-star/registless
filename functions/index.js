import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY);

export const createPayment = async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'eur',
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};