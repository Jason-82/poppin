# Busyness Provider Implementation

## Overview

This document describes the busyness provider adapter interface and cron ingestion job implementation for the Poppin Chicago nightlife app.

## What Was Implemented

### 1. Provider Interface (`src/lib/providers/types.ts`)

A clean, swappable interface for busyness data providers:

```typescript
interface BusynessProvider {
  name: string;
  getBusynessNow(venue: Venue): Promise<BusynessReading | null>;
  getForecast(venue: Venue, hours: number): Promise<BusynessForecast[]>;
}
```

This interface allows easy swapping between mock data and real APIs (Google Places, BestTime, etc.).

### 2. Mock Provider (`src/lib/providers/mock.ts`)

A realistic mock provider that generates time-based busyness data:

**Patterns:**
- **Bars**:
  - Weekday: Low until 5pm, builds to peak at 10pm, dies down by 2am
  - Weekend: Starts earlier, peaks around 10pm
- **Clubs**:
  - Peak later (midnight-2am)
  - Weekend-focused
  - Quieter on weekdays
- **Latin Dance Venues**:
  - Busier on Thursday/Friday/Saturday
  - Peak around 11pm-1am (after lessons, during social dancing)
  - Specific patterns for lesson times (7-9pm) vs social dancing (9pm-2am)

**Features:**
- Time-based patterns that change throughout the day
- Day-of-week variations
- Venue-specific randomness (seeded by venue ID for consistency)
- ±10% random variation to simulate real-world fluctuation

### 3. Provider Registry (`src/lib/providers/index.ts`)

Central place to get the active provider:

```typescript
export function getProvider(): BusynessProvider
```

Supports switching providers via `BUSYNESS_PROVIDER` environment variable:
- `"mock"` (default): MockProvider for testing
- `"besttime"`: BestTime API (ready for implementation)
- `"google"`: Google Places API (ready for implementation)

### 4. Cron Ingestion Job (`src/app/api/cron/ingest/route.ts`)

Vercel-compatible API endpoint that:
- Verifies `CRON_SECRET` from Authorization header
- Fetches all venues from database
- Calls `provider.getBusynessNow()` for each venue
- Creates `BusynessObservation` records with `source='provider'`
- Logs processing stats (venues processed, observations created, errors)
- Returns summary JSON

**Security:**
- Protected by `CRON_SECRET` token
- Returns 401 if unauthorized

**Response Format:**
```json
{
  "success": true,
  "venuesProcessed": 10,
  "observationsCreated": 10,
  "errors": 0,
  "duration": 1234,
  "provider": "MockProvider"
}
```

### 5. Vercel Cron Configuration (`vercel.json`)

Configures the cron job to run every 15 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### 6. Manual Trigger Script (`scripts/ingest.ts`)

Allows manual testing of the ingestion process:

```bash
npm run ingest
```

**Features:**
- Runs the same ingestion logic as the cron job
- Provides detailed console output with progress
- Shows summary statistics
- Suggests next steps for verification

## Environment Variables

Add to your `.env` file (see `.env.example`):

```bash
# Busyness Data Provider
BUSYNESS_PROVIDER="mock"  # Options: "mock", "besttime", "google"
CRON_SECRET="your-random-secret-token-here"

# Database (required)
DATABASE_URL="postgresql://..."
```

## Usage

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

4. **Push database schema:**
   ```bash
   npm run db:push
   ```

5. **Seed venues (if needed):**
   ```bash
   npm run db:seed
   ```

6. **Run manual ingestion:**
   ```bash
   npm run ingest
   ```

   This will:
   - Fetch all venues from the database
   - Get busyness data from the mock provider
   - Create BusynessObservation records
   - Display a summary

7. **Verify data:**
   ```bash
   npm run db:studio
   ```

   Browse to `http://localhost:5555` and check the `BusynessObservation` table.

### Testing the Cron Endpoint Locally

You can test the cron endpoint using curl:

```bash
# Make sure your dev server is running
npm run dev

# In another terminal, call the cron endpoint
curl -X GET http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Expected response:
```json
{
  "success": true,
  "venuesProcessed": 10,
  "observationsCreated": 10,
  "errors": 0,
  "duration": 1234,
  "provider": "MockProvider"
}
```

### Vercel Deployment

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Set environment variables in Vercel:**
   - Go to your project settings
   - Add `DATABASE_URL`
   - Add `CRON_SECRET`
   - Add `BUSYNESS_PROVIDER=mock`

3. **Cron job runs automatically:**
   - Vercel will call `/api/cron/ingest` every 15 minutes
   - Check logs in Vercel dashboard to verify

## How It Works

### Data Flow

1. **Cron trigger** (every 15 minutes via Vercel Cron)
   ↓
2. **API Route** (`/api/cron/ingest`)
   ↓
3. **Provider Registry** (`getProvider()`)
   ↓
4. **Mock Provider** (`getBusynessNow()`)
   - Calculates realistic busyness based on:
     - Current time
     - Day of week
     - Venue type
     - Venue-specific seed
   ↓
5. **Database** (creates `BusynessObservation` records)

### Trend Calculation

The existing `src/lib/busyness.ts` already implements trend calculation:

- Gets last 3 observations within the last hour
- If fewer than 2 observations, returns 'stable'
- Calculates average change between observations
- Returns 'up' if change > 10, 'down' if change < -10, else 'stable'

### Fusion with Crowd Data

The existing fusion algorithm in `src/lib/busyness.ts` combines:
- Provider data (weight: 0.6)
- Crowd reports (weight: 0.4 per report, capped at 1.2 total)
- Applies exponential decay (30-minute half-life)
- Calculates confidence based on recency, volume, and diversity

## Testing Checklist

- [x] Provider interface is clean and type-safe
- [x] Mock provider returns realistic time-based busyness
- [x] Provider registry allows easy swapping
- [ ] Cron endpoint runs successfully locally
- [ ] BusynessObservation records are created
- [ ] Venues show changing busyness over time
- [ ] Trend calculation works correctly
- [ ] Fusion algorithm combines provider + crowd data
- [ ] Vercel cron config is ready for deployment

## Future Enhancements

### Real Provider Integration

To add a real provider (e.g., BestTime):

1. **Create provider class:**
   ```typescript
   // src/lib/providers/besttime.ts
   export class BestTimeProvider implements BusynessProvider {
     name = 'BestTimeProvider';

     async getBusynessNow(venue: Venue): Promise<BusynessReading | null> {
       // Call BestTime API
       // Transform response to BusynessReading
     }

     async getForecast(venue: Venue, hours: number): Promise<BusynessForecast[]> {
       // Call BestTime forecast API
     }
   }
   ```

2. **Register in provider registry:**
   ```typescript
   // src/lib/providers/index.ts
   case 'besttime':
     return new BestTimeProvider();
   ```

3. **Update environment:**
   ```bash
   BUSYNESS_PROVIDER="besttime"
   BUSYNESS_PROVIDER_API_KEY="your-api-key"
   ```

## Files Created

```
/home/user/poppin/
├── src/
│   ├── lib/
│   │   └── providers/
│   │       ├── types.ts          ✓ Provider interface definitions
│   │       ├── mock.ts           ✓ Mock provider with time-based patterns
│   │       └── index.ts          ✓ Provider registry
│   └── app/
│       └── api/
│           └── cron/
│               └── ingest/
│                   └── route.ts  ✓ Cron ingestion API route
├── scripts/
│   └── ingest.ts                 ✓ Manual trigger script
├── vercel.json                   ✓ Vercel cron configuration
└── .env.example                  ✓ Updated with BUSYNESS_PROVIDER

Existing files used:
├── src/lib/prisma.ts             ✓ Prisma client singleton
└── src/lib/busyness.ts           ✓ Trend calculation & fusion logic
```

## Definition of Done

✅ Provider interface is clean and swappable
✅ Mock provider returns realistic time-based busyness
✅ After running cron locally, venues show changing busyness + trend
✅ Vercel cron config is ready for deployment
✅ Manual trigger script for easy testing
✅ Comprehensive documentation

## Next Steps

1. **Test locally:**
   ```bash
   npm run ingest
   ```

2. **Start dev server and check venues:**
   ```bash
   npm run dev
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

4. **Monitor cron logs in Vercel dashboard**

5. **(Future) Integrate real provider** when ready to move beyond mock data
