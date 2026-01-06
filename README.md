# Poppin - Chicago Nightlife Busyness App

> Real-time crowd levels for Chicago nightlife

A "Waze for nightlife" web app that shows real-time busyness information for bars, clubs, and latin dance venues in Chicago. Combines provider data with crowdsourced reports.

## Features

- **Interactive Map**: Browse venues on a Leaflet map with color-coded busyness markers
- **Venue Filters**: Filter by type (bars, clubs, latin dance)
- **Real-time Busyness**: See current busyness level (Quiet/Warm/Busy/Packed)
- **Trend Indicators**: Know if venues are getting busier or quieting down
- **Crowdsourced Reports**: Submit anonymous "vibe reports" from venues
- **Favorites**: Save your favorite spots for quick access
- **Privacy-First**: No user accounts, no tracking, anonymous reporting

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Map**: Leaflet with OpenStreetMap tiles
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Prisma ORM (Supabase)
- **Deployment**: Vercel

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Supabase recommended)

### 1. Clone and Install

```bash
git clone <repo-url>
cd poppin
npm install
```

### 2. Set Up Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:
```env
DATABASE_URL="postgresql://..."  # Your Supabase connection string
APP_PASSCODE="your-secret-code"  # Access code for friends-only testing
CRON_SECRET="random-secret"      # Secret for cron job authentication
```

### 3. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed with Chicago venues
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 and enter your passcode to access the app.

## Project Structure

```
poppin/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Venue seed data
├── scripts/
│   └── ingest.ts          # Manual busyness ingestion
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── map/           # Map page
│   │   ├── venue/[id]/    # Venue detail page
│   │   ├── favorites/     # Favorites page
│   │   └── page.tsx       # Passcode gate
│   ├── components/        # React components
│   └── lib/
│       ├── providers/     # Busyness data providers
│       ├── prisma.ts      # Prisma client
│       ├── busyness.ts    # Fusion algorithm
│       └── auth.ts        # Authentication helpers
├── ARCHITECTURE.md        # Full architecture documentation
└── PRIVACY_SECURITY.md    # Privacy & security review
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify` | Verify passcode |
| GET | `/api/venues` | List venues with busyness |
| GET | `/api/venues/[id]` | Get venue details |
| POST | `/api/venues/[id]/report` | Submit crowd report |
| GET | `/api/venues/[id]/busyness` | Get busyness history |
| GET | `/api/cron/ingest` | Cron: ingest provider data |

## NPM Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run db:seed    # Seed venue data
npm run db:studio  # Open Prisma Studio
npm run ingest     # Manually run busyness ingestion
```

## Deployment (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

The cron job is configured in `vercel.json` to run every 15 minutes.

## Privacy & Security

- **No user accounts** - Anonymous access with shared passcode
- **No tracking** - Only explicit reports are stored
- **IP hashing** - IPs are hashed before storage
- **Rate limiting** - 5 reports/hour per IP
- **Confidence gating** - Low-data venues show "Limited Data"

See `PRIVACY_SECURITY.md` for full review.

## License

MIT
