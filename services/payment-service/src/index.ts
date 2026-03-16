// ===========================================
// ORFLOW - Payment Service
// Stripe Connect for marketplace payments
// ===========================================

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLATFORM_FEE_PCT = 0.05; // 5% platform fee

// ===========================================
// Create Stripe Customer
// ===========================================

export async function createStripeCustomer(userId: string, email: string, name: string): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { orflow_user_id: userId },
  });

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
}

// ===========================================
// Stripe Connect for Sellers
// ===========================================

export async function createSellerOnboardingLink(userId: string, email: string): Promise<string> {
  // Create Stripe Connect account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'FR',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { orflow_user_id: userId },
  });

  await supabase
    .from('profiles')
    .update({ stripe_account_id: account.id })
    .eq('id', userId);

  // Create onboarding link
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/seller/stripe/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/seller/stripe/complete`,
    type: 'account_onboarding',
  });

  return link.url;
}

// ===========================================
// Create Payment Intent (for offers/direct sales)
// ===========================================

export async function createPaymentIntent(orderId: string): Promise<{
  clientSecret: string;
  paymentIntentId: string;
}> {
  const { data: order } = await supabase
    .from('orders')
    .select('*, seller:profiles(stripe_account_id), buyer:profiles(stripe_customer_id)')
    .eq('id', orderId)
    .single();

  if (!order) throw new Error('Order not found');

  const amountCents = Math.round(order.amount_eur * 100);
  const platformFeeCents = Math.round(order.platform_fee_eur * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    customer: order.buyer?.stripe_customer_id || undefined,
    transfer_data: {
      destination: order.seller?.stripe_account_id,
    },
    application_fee_amount: platformFeeCents,
    metadata: {
      order_id: orderId,
      seller_payout: order.seller_payout_eur.toString(),
    },
  });

  // Update order with payment intent
  await supabase
    .from('orders')
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      status: 'payment_pending',
    })
    .eq('id', orderId);

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

// ===========================================
// Webhook Handler
// ===========================================

export async function handleStripeWebhook(payload: string, signature: string): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.order_id;

      if (orderId) {
        await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', orderId);

        // Notify seller
        const { data: order } = await supabase
          .from('orders')
          .select('seller_id, buyer_id, amount_eur')
          .eq('id', orderId)
          .single();

        if (order) {
          await supabase.from('notifications').insert([
            {
              user_id: order.seller_id,
              type: 'payment_received',
              title: 'Paiement reçu !',
              body: `Votre vente de ${order.amount_eur}€ a été payée.`,
              data: { order_id: orderId },
            },
            {
              user_id: order.buyer_id,
              type: 'payment_received',
              title: 'Paiement confirmé',
              body: 'Votre achat a été confirmé. Le vendeur va préparer l\'envoi.',
              data: { order_id: orderId },
            },
          ]);
        }
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.order_id;

      if (orderId) {
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId);
      }
      break;
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      if (account.details_submitted) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_account_id', account.id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ is_verified: true })
            .eq('id', profile.id);
        }
      }
      break;
    }
  }
}

// ===========================================
// Create Order from Offer
// ===========================================

export async function createOrderFromOffer(offerId: string): Promise<string> {
  const { data: offer } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer || offer.status !== 'accepted') throw new Error('Offer not accepted');

  const amount = offer.amount_eur;
  const platformFee = amount * PLATFORM_FEE_PCT;
  const sellerPayout = amount - platformFee;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      listing_id: offer.listing_id,
      buyer_id: offer.buyer_id,
      seller_id: offer.seller_id,
      offer_id: offerId,
      amount_eur: amount,
      platform_fee_eur: platformFee,
      seller_payout_eur: sellerPayout,
      status: 'confirmed',
    })
    .select()
    .single();

  if (error) throw error;

  // Mark listing as sold
  await supabase
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', offer.listing_id);

  return order.id;
}
