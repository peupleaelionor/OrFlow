// ===========================================
// ORFLOW - Notification Service
// Email + in-app notifications
// ===========================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===========================================
// Email Sender (using Resend)
// ===========================================

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email] To: ${to} | Subject: ${subject} (email not configured)`);
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'OrFlow <noreply@orflow.com>',
      to: [to],
      subject,
      html,
    }),
  });
}

// ===========================================
// Notification Templates
// ===========================================

export const EmailTemplates = {
  newOffer: (buyerName: string, offerAmount: number, listingTitle: string, offerId: string) => ({
    subject: `Nouvelle offre de ${offerAmount}€ sur "${listingTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #d4af37, #a16207); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">OrFlow</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937;">Vous avez reçu une offre !</h2>
          <p style="color: #6b7280;">${buyerName} vous offre <strong style="color: #d4af37; font-size: 20px;">${offerAmount}€</strong> pour votre annonce "${listingTitle}".</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/offers/${offerId}"
               style="background: #d4af37; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Voir l'offre
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">OrFlow — La marketplace de l'or recyclé</p>
        </div>
      </div>
    `,
  }),

  auctionWon: (winnerName: string, finalPrice: number, auctionTitle: string, orderId: string) => ({
    subject: `🏆 Félicitations ! Vous avez remporté "${auctionTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #d4af37, #a16207); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🏆 OrFlow</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937;">Félicitations ${winnerName} !</h2>
          <p style="color: #6b7280;">Vous avez remporté l'enchère <strong>"${auctionTitle}"</strong> pour <strong style="color: #d4af37;">${finalPrice}€</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}/pay"
               style="background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Procéder au paiement
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  bidOutbid: (bidderName: string, auctionTitle: string, newPrice: number, auctionId: string) => ({
    subject: `⚡ Vous avez été surenchéri sur "${auctionTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">⚡ Surenchère sur OrFlow</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #6b7280;">Bonjour ${bidderName}, quelqu'un a surenchéri sur "${auctionTitle}".</p>
          <p style="color: #6b7280;">Nouvelle enchère: <strong style="color: #d4af37; font-size: 20px;">${newPrice}€</strong></p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/auction/${auctionId}"
               style="background: #d4af37; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Renchérir maintenant
            </a>
          </div>
        </div>
      </div>
    `,
  }),
};

// ===========================================
// Notification Dispatcher
// ===========================================

export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  // Save in-app notification
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data,
  });

  // Get user email for email notifications
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  if (!user?.email) return;

  // Send email based on type
  switch (type) {
    case 'offer_received': {
      const { subject, html } = EmailTemplates.newOffer(
        data.buyer_name as string,
        data.offer_amount as number,
        data.listing_title as string,
        data.offer_id as string
      );
      await sendEmail(user.email, subject, html);
      break;
    }
    case 'auction_won': {
      const { subject, html } = EmailTemplates.auctionWon(
        user.user_metadata?.full_name || 'Acheteur',
        data.final_price as number,
        data.auction_title as string,
        data.order_id as string
      );
      await sendEmail(user.email, subject, html);
      break;
    }
    case 'bid_outbid': {
      const { subject, html } = EmailTemplates.bidOutbid(
        user.user_metadata?.full_name || 'Enchérisseur',
        data.auction_title as string,
        data.new_price as number,
        data.auction_id as string
      );
      await sendEmail(user.email, subject, html);
      break;
    }
  }
}

// ===========================================
// Arbitrage Alerts
// ===========================================

export async function sendArbitrageAlerts(): Promise<void> {
  // Get new high-margin opportunities
  const { data: opportunities } = await supabase
    .from('scraped_listings')
    .select('*')
    .eq('is_opportunity', true)
    .gte('arbitrage_margin_pct', 50) // >50% margin = high priority
    .gte('scraped_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // last hour
    .order('arbitrage_margin_pct', { ascending: false })
    .limit(5);

  if (!opportunities?.length) return;

  // Get admin users
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  for (const admin of (admins || [])) {
    await supabase.from('notifications').insert({
      user_id: admin.id,
      type: 'system',
      title: `🔥 ${opportunities.length} nouvelles opportunités d'arbitrage !`,
      body: `La plus haute marge: +${opportunities[0].arbitrage_margin_pct?.toFixed(0)}% sur ${opportunities[0].source_platform}`,
      data: { opportunities: opportunities.map(o => o.id) },
    });
  }
}
