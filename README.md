# OrFlow Platform

> The global infrastructure for recycled gold trading.

## Architecture

```
orflow-platform/
├── apps/
│   ├── web/           # Next.js 14 frontend (buyer/seller/public)
│   └── admin/         # Admin dashboard
├── services/
│   ├── gold-pricing/  # Real-time gold price engine
│   ├── auction-engine/# Socket.IO real-time bidding
│   ├── matching-engine/# Order book (Peatio-inspired)
│   ├── listing-service/# Seller marketplace
│   ├── payment-service/# Stripe Connect
│   ├── notification-service/ # Email + in-app
│   ├── data-collector/# Web scraper pipeline
│   └── ai-valuation/  # Claude AI gold estimation
├── packages/
│   ├── types/         # Shared TypeScript types
│   └── ui/            # Shared UI components
└── infra/
    ├── supabase/      # Database + auth + realtime
    └── docker/        # Container configs
```

## Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
# Fill in your API keys (Supabase, Stripe, GoldAPI, Anthropic)
```

### 2. Database Setup
```bash
npx supabase start
npx supabase db push
```

### 3. Start Development
```bash
pnpm install
pnpm dev
```

### 4. Docker (Production)
```bash
docker-compose up -d
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| web | 3000 | Next.js frontend |
| auction-engine | 3001 | Real-time WebSocket |
| redis | 6379 | Auction state cache |

## Key Features

### Gold Estimation Engine
- Formula: `value = weight × (carat/24) × spot_price`
- Real-time spot price from GoldAPI
- AI-powered image analysis (Claude Haiku)
- All purities: 8k, 9k, 14k, 18k, 21k, 22k, 24k, 999‰

### Auction System (Peatio-inspired)
- Real-time WebSockets (Socket.IO)
- Auto-bidding logic
- 10-second timer engine
- Order creation on settlement

### Marketplace
- Seller listings with AI valuation
- Offer/counter-offer negotiation
- Review system

### Arbitrage Detection
- Scrapes LeBonCoin, eBay France
- AI estimates gold content
- Alerts when margin > 30%
- Pro buyer dashboard

### SEO Growth Engine
- City pages: `/or/paris`, `/or/lyon`, etc.
- Local market data per city

### Payment (Stripe Connect)
- 5% platform fee
- Instant seller payouts via Stripe Express

## Environment Variables

See `.env.example` for all required variables.

Key services:
- **Supabase** — DB + Auth + Storage + Realtime
- **Stripe** — Payments + Connect (sellers)
- **GoldAPI** — Real-time gold prices
- **Anthropic Claude** — AI valuation
- **Resend** — Email notifications

## License

Private — OrFlow © 2025