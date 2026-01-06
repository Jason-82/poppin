# Poppin - Chicago Nightlife Busyness App Architecture

## Overview
Poppin is a "Waze for nightlife busyness" web application focused on Chicago venues. It provides real-time busyness data by combining baseline data from a provider API with crowdsourced reports from users.

**Key Constraints:**
- Web-only (no mobile app)
- Friends-only private test with app-level passcode gate
- Hybrid data model: baseline busyness provider + crowdsourced vibe reports
- Deployed on Vercel (no custom domain needed)
- Next.js 14+ App Router with TypeScript
- Tailwind CSS for styling
- Prisma ORM with PostgreSQL (Supabase)
- Leaflet for maps

---

## 1. Repository Structure

```
poppin/
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore file
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── next.config.ts               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── postcss.config.mjs           # PostCSS configuration
├── eslint.config.mjs            # ESLint configuration
├── ARCHITECTURE.md              # This file
├── README.md                    # Project documentation
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Database migrations
│   └── seed.ts                  # Database seed script
│
├── public/                      # Static assets
│   ├── favicon.ico
│   └── images/
│
└── src/
    ├── app/                     # Next.js App Router
    │   ├── layout.tsx           # Root layout
    │   ├── page.tsx             # Home page (map view)
    │   ├── globals.css          # Global styles
    │   │
    │   ├── api/                 # API routes
    │   │   ├── auth/
    │   │   │   └── verify/
    │   │   │       └── route.ts # POST /api/auth/verify
    │   │   ├── venues/
    │   │   │   ├── route.ts     # GET /api/venues
    │   │   │   └── [id]/
    │   │   │       ├── route.ts             # GET /api/venues/[id]
    │   │   │       ├── report/
    │   │   │       │   └── route.ts         # POST /api/venues/[id]/report
    │   │   │       └── busyness/
    │   │   │           └── route.ts         # GET /api/venues/[id]/busyness
    │   │   └── cron/
    │   │       └── ingest/
    │   │           └── route.ts # GET /api/cron/ingest
    │   │
    │   └── venue/
    │       └── [id]/
    │           └── page.tsx     # Venue detail page
    │
    ├── components/              # React components
    │   ├── auth/
    │   │   └── PasscodeGate.tsx # App-level passcode modal
    │   ├── map/
    │   │   ├── MapView.tsx      # Main Leaflet map component
    │   │   ├── VenueMarker.tsx  # Individual venue marker
    │   │   └── MapControls.tsx  # Map filters and controls
    │   ├── venue/
    │   │   ├── VenueCard.tsx    # Venue info card
    │   │   ├── VenueList.tsx    # List view of venues
    │   │   ├── BusynessGauge.tsx # Visual busyness indicator
    │   │   └── ReportForm.tsx   # Crowd report submission form
    │   └── ui/
    │       ├── Button.tsx
    │       ├── Input.tsx
    │       ├── Card.tsx
    │       └── Badge.tsx
    │
    ├── lib/                     # Utility libraries
    │   ├── prisma.ts            # Prisma client singleton
    │   ├── auth.ts              # Passcode verification utilities
    │   ├── busyness/
    │   │   ├── fusion.ts        # Busyness data fusion logic
    │   │   ├── provider.ts      # External busyness provider integration
    │   │   └── calculator.ts    # Trend and confidence calculations
    │   ├── geocoding.ts         # Address to lat/lng conversion
    │   ├── rateLimit.ts         # Rate limiting middleware
    │   └── utils.ts             # General utilities
    │
    ├── types/                   # TypeScript type definitions
    │   ├── venue.ts
    │   ├── busyness.ts
    │   ├── report.ts
    │   └── api.ts
    │
    └── middleware.ts            # Next.js middleware (auth check)
```

---

## 2. Data Model (Prisma Schema)

The database schema is defined in `prisma/schema.prisma`:

### Venue Model
Stores information about nightlife venues in Chicago.

```prisma
model Venue {
  id               String                 @id @default(cuid())
  name             String
  address          String
  latitude         Float
  longitude        Float
  type             VenueType              // bar, club, latin_dance
  googlePlaceId    String?                @unique
  description      String?
  phoneNumber      String?
  website          String?
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  busynessObservations BusynessObservation[]
  crowdReports         CrowdReport[]

  @@index([latitude, longitude])
  @@index([type])
}

enum VenueType {
  bar
  club
  latin_dance
}
```

**Fields:**
- `id`: Unique identifier (CUID)
- `name`: Venue name
- `address`: Full street address
- `latitude`, `longitude`: Coordinates for map display
- `type`: Category of venue
- `googlePlaceId`: Optional Google Places ID for data enrichment
- Timestamps for tracking creation and updates

**Indexes:**
- Geospatial index on `(latitude, longitude)` for bounding box queries
- Index on `type` for filtering

### BusynessObservation Model
Stores busyness data points from both provider API and crowdsourced reports.

```prisma
model BusynessObservation {
  id        String              @id @default(cuid())
  venueId   String
  venue     Venue               @relation(fields: [venueId], references: [id], onDelete: Cascade)
  source    BusynessSource      // 'provider' or 'crowd'
  level     Int                 // 0-100 normalized busyness level
  timestamp DateTime            @default(now())

  @@index([venueId, timestamp])
  @@index([timestamp])
}

enum BusynessSource {
  provider  // From external API
  crowd     // Derived from CrowdReport
}
```

**Fields:**
- `source`: Distinguishes provider data from crowdsourced data
- `level`: Normalized 0-100 scale (0 = empty, 100 = at capacity)
- `timestamp`: When the observation was recorded

**Indexes:**
- Composite index on `(venueId, timestamp)` for time-series queries
- Index on `timestamp` for cleanup/archival

### CrowdReport Model
Stores raw crowdsourced reports submitted by users.

```prisma
model CrowdReport {
  id            String          @id @default(cuid())
  venueId       String
  venue         Venue           @relation(fields: [venueId], references: [id], onDelete: Cascade)
  level         CrowdLevel      // dead, warm, busy, packed
  tags          String[]        // ["good_music", "long_wait", "great_crowd"]
  browserToken  String          // Fingerprint/session identifier
  ipAddress     String
  userAgent     String?
  createdAt     DateTime        @default(now())

  @@index([venueId, createdAt])
  @@index([createdAt])
  @@index([browserToken])
}

enum CrowdLevel {
  dead    // 0-25
  warm    // 26-50
  busy    // 51-75
  packed  // 76-100
}
```

**Fields:**
- `level`: User-friendly categorical busyness level
- `tags`: Array of vibe/experience tags (optional)
- `browserToken`: Browser fingerprint for abuse prevention
- `ipAddress`: IP address for rate limiting and spam detection
- `userAgent`: Browser/device info for analytics

**Indexes:**
- Composite index on `(venueId, createdAt)` for recent reports per venue
- Index on `browserToken` for rate limiting per user

---

## 3. API Routes

All API routes return JSON responses with consistent error handling.

### Authentication

#### POST /api/auth/verify
Verifies the app-level passcode.

**Request Body:**
```typescript
{
  passcode: string
}
```

**Response (200):**
```typescript
{
  success: true,
  message: "Access granted"
}
```

**Response (401):**
```typescript
{
  success: false,
  error: "Invalid passcode"
}
```

**Implementation Notes:**
- Sets an HTTP-only cookie upon successful verification
- Cookie expires in 30 days
- Uses constant-time comparison to prevent timing attacks

---

### Venues

#### GET /api/venues
Retrieves venues within a bounding box with optional filters.

**Query Parameters:**
```typescript
{
  neLat: number,    // Northeast corner latitude
  neLng: number,    // Northeast corner longitude
  swLat: number,    // Southwest corner latitude
  swLng: number,    // Southwest corner longitude
  type?: VenueType, // Optional: filter by venue type
  limit?: number    // Optional: max results (default 100)
}
```

**Response (200):**
```typescript
{
  venues: [
    {
      id: string,
      name: string,
      address: string,
      latitude: number,
      longitude: number,
      type: "bar" | "club" | "latin_dance",
      currentBusyness: {
        level: number,        // 0-100
        confidence: number,   // 0-1
        trend: "up" | "down" | "stable",
        lastUpdated: string   // ISO timestamp
      }
    }
  ],
  total: number
}
```

**Implementation Notes:**
- Uses geospatial index for efficient bounding box queries
- Calls busyness fusion logic to calculate `currentBusyness` for each venue
- Rate limited to prevent abuse

---

#### GET /api/venues/[id]
Retrieves detailed information for a specific venue.

**Response (200):**
```typescript
{
  id: string,
  name: string,
  address: string,
  latitude: number,
  longitude: number,
  type: "bar" | "club" | "latin_dance",
  description?: string,
  phoneNumber?: string,
  website?: string,
  currentBusyness: {
    level: number,
    confidence: number,
    trend: "up" | "down" | "stable",
    lastUpdated: string
  },
  recentReports: [
    {
      level: "dead" | "warm" | "busy" | "packed",
      tags: string[],
      createdAt: string,
      timeAgo: string  // e.g., "5 minutes ago"
    }
  ]
}
```

**Response (404):**
```typescript
{
  error: "Venue not found"
}
```

**Implementation Notes:**
- Includes recent crowd reports (last 6 hours, max 20)
- Anonymizes reports (no IP/browser token exposed)

---

#### POST /api/venues/[id]/report
Submits a crowdsourced busyness report for a venue.

**Request Body:**
```typescript
{
  level: "dead" | "warm" | "busy" | "packed",
  tags?: string[]  // Optional array of tags
}
```

**Response (201):**
```typescript
{
  success: true,
  reportId: string,
  message: "Report submitted successfully"
}
```

**Response (400):**
```typescript
{
  error: "Invalid level or tags"
}
```

**Response (429):**
```typescript
{
  error: "Rate limit exceeded. Please try again later."
}
```

**Response (404):**
```typescript
{
  error: "Venue not found"
}
```

**Implementation Notes:**
- Extracts IP address and user agent from request headers
- Generates browser fingerprint using client-side library
- Rate limited: max 5 reports per IP per hour, max 10 per browser token per hour
- Creates `CrowdReport` record
- Converts categorical level to 0-100 scale and creates `BusynessObservation` record
- Validates tags against whitelist if provided

**Level Conversion:**
- `dead` → 12 (midpoint of 0-25)
- `warm` → 38 (midpoint of 26-50)
- `busy` → 63 (midpoint of 51-75)
- `packed` → 88 (midpoint of 76-100)

---

#### GET /api/venues/[id]/busyness
Retrieves historical busyness data for a venue.

**Query Parameters:**
```typescript
{
  hours?: number  // Optional: hours of history (default 24, max 168)
}
```

**Response (200):**
```typescript
{
  venueId: string,
  venueName: string,
  current: {
    level: number,
    confidence: number,
    trend: "up" | "down" | "stable",
    lastUpdated: string
  },
  history: [
    {
      timestamp: string,
      level: number,
      source: "provider" | "crowd" | "fused"
    }
  ]
}
```

**Response (404):**
```typescript
{
  error: "Venue not found"
}
```

**Implementation Notes:**
- Returns time-series data for charting
- Aggregates observations into hourly buckets
- Distinguishes between provider data, crowd data, and fused result

---

### Cron Jobs

#### GET /api/cron/ingest
Ingests busyness data from the external provider API for all venues.

**Headers:**
```typescript
{
  Authorization: "Bearer <CRON_SECRET>"
}
```

**Response (200):**
```typescript
{
  success: true,
  venuesProcessed: number,
  observationsCreated: number,
  errors: number,
  duration: number  // milliseconds
}
```

**Response (401):**
```typescript
{
  error: "Unauthorized"
}
```

**Implementation Notes:**
- Secured with `CRON_SECRET` header verification
- Configured in Vercel to run every 15 minutes
- Fetches busyness data from provider API for all active venues
- Creates `BusynessObservation` records with `source: "provider"`
- Handles API rate limits and errors gracefully
- Logs processing stats for monitoring

**Vercel Cron Configuration (vercel.json):**
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

---

## 4. Busyness Fusion Approach

The app combines data from two sources to provide accurate, real-time busyness information:

1. **Provider Data**: Baseline busyness from external API (e.g., Google Places, Besttime.app)
2. **Crowd Data**: Real-time reports submitted by users

### Fusion Algorithm

Located in `src/lib/busyness/fusion.ts`:

```typescript
interface FusedBusyness {
  level: number;        // 0-100
  confidence: number;   // 0-1
  trend: "up" | "down" | "stable";
  lastUpdated: Date;
}

function fuseBusynessData(
  venueId: string,
  currentTime: Date
): FusedBusyness
```

#### Step 1: Gather Recent Observations
- Fetch provider observations from last 2 hours
- Fetch crowd observations from last 2 hours
- If no data exists, return `{ level: 50, confidence: 0, trend: "stable" }`

#### Step 2: Calculate Weighted Average
Weight observations based on:
- **Recency**: Exponential decay with 30-minute half-life
- **Source reliability**:
  - Provider data: baseline weight of 0.6
  - Crowd data: baseline weight of 0.4 per report, capped at total weight of 1.2

**Weighting Formula:**
```
recencyWeight = exp(-age_in_minutes / 30)
finalWeight = baseWeight * recencyWeight
```

**Example:**
- Provider observation from 10 minutes ago: `weight = 0.6 * exp(-10/30) = 0.43`
- Crowd observation from 5 minutes ago: `weight = 0.4 * exp(-5/30) = 0.34`
- Crowd observation from 5 minutes ago: `weight = 0.4 * exp(-5/30) = 0.34`
- Total crowd weight: `0.68`

**Fused Level:**
```
fusedLevel = (sum of weighted levels) / (sum of weights)
           = (0.43 * 60 + 0.34 * 75 + 0.34 * 80) / (0.43 + 0.68)
           = (25.8 + 25.5 + 27.2) / 1.11
           = 70.8
```

#### Step 3: Calculate Confidence
Confidence increases with:
- More recent data
- More data points
- Mix of provider and crowd data

**Confidence Formula:**
```typescript
function calculateConfidence(
  observations: Observation[],
  currentTime: Date
): number {
  if (observations.length === 0) return 0;

  const mostRecentAge = (currentTime - mostRecentObservation.timestamp) / (1000 * 60); // minutes
  const recencyFactor = Math.max(0, 1 - mostRecentAge / 60); // Decay over 1 hour

  const volumeFactor = Math.min(1, observations.length / 5); // Confidence saturates at 5 observations

  const diversityFactor = hasBothSources ? 1.0 : 0.8; // Bonus for having both provider and crowd data

  return recencyFactor * volumeFactor * diversityFactor;
}
```

**Confidence Examples:**
- 1 crowd report from 5 min ago: `confidence = 0.92 * 0.2 * 0.8 = 0.15`
- 3 crowd reports + 1 provider (most recent 10 min ago): `confidence = 0.83 * 0.8 * 1.0 = 0.66`
- 5+ reports from both sources (most recent 2 min ago): `confidence = 0.97 * 1.0 * 1.0 = 0.97`

#### Step 4: Calculate Trend
Compare average level from last 30 minutes to average from 30-60 minutes ago.

**Trend Logic:**
```typescript
const recent = avgLevel(last30Minutes);
const previous = avgLevel(30to60MinutesAgo);
const change = recent - previous;

if (Math.abs(change) < 10) return "stable";
if (change > 0) return "up";
return "down";
```

If insufficient historical data, return `"stable"`.

#### Step 5: Return Fused Result
```typescript
return {
  level: Math.round(fusedLevel),
  confidence: Math.round(confidence * 100) / 100,
  trend: trend,
  lastUpdated: mostRecentObservation.timestamp
};
```

### Edge Cases
- **No data available**: Return default with 0 confidence
- **Only provider data**: Use provider level, moderate confidence (0.5-0.7)
- **Only crowd data**: Use crowd average, lower confidence (0.3-0.5)
- **Conflicting data**: Weighted average naturally handles this; high variance decreases confidence
- **Stale data (>2 hours old)**: Exclude from calculations

### Performance Optimization
- Cache fused busyness results for 5 minutes per venue
- Use database indexes for efficient time-range queries
- Aggregate observations in a single query

---

## 5. App-Level Passcode Gate

### Implementation
Located in `src/components/auth/PasscodeGate.tsx` and `src/middleware.ts`:

#### Client-Side Component
```typescript
// Displays a modal on app load
// Checks for auth cookie
// If no cookie, prompts for passcode
// Submits to /api/auth/verify
// On success, stores cookie and renders app
// Blocks all content until verified
```

#### Middleware
```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get("poppin_auth");

  if (!authCookie && !request.url.includes("/api/auth/verify")) {
    // Return 401 for API routes
    // For pages, let client-side gate handle it
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/venue/:path*"]
};
```

#### Security Considerations
- Passcode stored in environment variable (`APP_PASSCODE`)
- HTTP-only cookie prevents XSS attacks
- Cookie expires in 30 days
- Constant-time string comparison prevents timing attacks
- No account system needed for private test

---

## 6. Technology Stack Details

### Frontend
- **Next.js 14+**: App Router for file-based routing and server components
- **React 18+**: UI component framework
- **TypeScript**: Type safety and developer experience
- **Tailwind CSS**: Utility-first styling
- **Leaflet + react-leaflet**: Interactive map display
- **SWR or TanStack Query**: Data fetching and caching (optional)

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Prisma**: Type-safe ORM for database access
- **PostgreSQL (Supabase)**: Relational database

### Deployment
- **Vercel**: Hosting platform with built-in CI/CD
- **Vercel Cron**: Scheduled jobs for data ingestion
- **Vercel Analytics**: Optional performance monitoring

### External Services
- **Supabase**: Managed PostgreSQL database
- **Busyness Provider API**: External service for baseline data (e.g., Besttime.app, Google Places)
- **Google Places API (Optional)**: Venue data enrichment

---

## 7. Setup and Run Instructions (For Non-Technical Owner)

### Prerequisites
You need accounts for:
1. **Vercel** (free): https://vercel.com/signup
2. **Supabase** (free tier): https://supabase.com
3. **Busyness API Provider** (varies): Options include Besttime.app or Google Places API

### Initial Setup (One-Time)

#### Step 1: Clone and Install
```bash
# Navigate to the project directory
cd poppin

# Install all dependencies
npm install
```

#### Step 2: Set Up Database
1. Go to https://supabase.com and create a new project
2. Wait for the database to finish provisioning (2-3 minutes)
3. Go to Project Settings > Database
4. Copy the "Connection String" (URI format)
5. Create a file named `.env` in the project root (copy from `.env.example`)
6. Paste your database URL into `DATABASE_URL` in `.env`

#### Step 3: Configure Environment Variables
Edit the `.env` file:
```env
DATABASE_URL="postgresql://..."  # From Supabase
APP_PASSCODE="your-secret-password"  # Choose a password for friends
BUSYNESS_PROVIDER_API_KEY="..."  # From your provider
GOOGLE_PLACES_API_KEY="..."  # Optional
CRON_SECRET="random-string-here"  # Generate a random string
```

#### Step 4: Initialize Database
```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push

# (Optional) Add seed data for Chicago venues
npm run seed
```

#### Step 5: Run Locally
```bash
# Start the development server
npm run dev
```

Open http://localhost:3000 in your browser. You'll be prompted for the passcode.

### Deploying to Vercel

#### Step 1: Connect to Vercel
```bash
# Install Vercel CLI (one-time)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

Follow the prompts:
- Link to existing project? **No**
- Project name? **poppin** (or your choice)
- Which directory? **./** (current directory)

#### Step 2: Add Environment Variables in Vercel
1. Go to your project in Vercel dashboard
2. Click "Settings" > "Environment Variables"
3. Add each variable from your `.env` file:
   - `DATABASE_URL`
   - `APP_PASSCODE`
   - `BUSYNESS_PROVIDER_API_KEY`
   - `GOOGLE_PLACES_API_KEY`
   - `CRON_SECRET`
   - `RATE_LIMIT_MAX_REQUESTS` (optional)
   - etc.

#### Step 3: Deploy to Production
```bash
vercel --prod
```

Your app will be live at `https://poppin-xxx.vercel.app`

#### Step 4: Configure Cron Job
Create a file `vercel.json` in the project root:
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

Redeploy:
```bash
vercel --prod
```

The cron job will automatically fetch busyness data every 15 minutes.

### Adding Venues

#### Option 1: Manual (Prisma Studio)
```bash
npx prisma studio
```
This opens a GUI at http://localhost:5555 where you can add venues manually.

#### Option 2: Seed Script
Edit `prisma/seed.ts` to add Chicago venues, then run:
```bash
npm run seed
```

#### Option 3: Admin API (Future)
Build an admin panel at `/admin` for managing venues via UI.

### Monitoring and Maintenance

#### View Logs
```bash
# In Vercel dashboard:
# Project > Deployments > [Latest] > Logs
```

#### Check Database
```bash
# Open Prisma Studio
npx prisma studio

# Or connect to Supabase dashboard
```

#### Update Dependencies
```bash
# Check for updates
npm outdated

# Update all
npm update
```

### Troubleshooting

#### "Database not found" error
- Make sure `DATABASE_URL` in Vercel matches your Supabase connection string
- Run `npx prisma db push` to create tables

#### Map not loading
- Check browser console for errors
- Ensure `latitude` and `longitude` values are valid
- Verify Leaflet CSS is imported in `layout.tsx`

#### Cron job not running
- Verify `vercel.json` is deployed
- Check cron logs in Vercel dashboard
- Ensure `CRON_SECRET` matches in both code and environment variables

#### Passcode not working
- Clear browser cookies and try again
- Verify `APP_PASSCODE` in Vercel environment variables
- Check browser console for errors

### Sharing with Friends
1. Get your Vercel URL (e.g., `https://poppin-xxx.vercel.app`)
2. Share the URL and passcode with friends
3. They'll enter the passcode once and have access for 30 days

### Making Updates
```bash
# Make code changes
# Test locally with `npm run dev`
# Deploy to Vercel
vercel --prod
```

Changes are live in ~30 seconds!

---

## 8. Future Enhancements (Post-MVP)

### Phase 2: Enhanced Features
- **User accounts**: Replace passcode with proper authentication
- **Notifications**: Alert users when favorite venues get busy
- **Historical patterns**: "Usually busy on Friday nights"
- **Photos**: User-submitted venue photos
- **Admin dashboard**: Manage venues, moderate reports

### Phase 3: Expansion
- **More cities**: Expand beyond Chicago
- **Mobile app**: React Native or Progressive Web App
- **Social features**: Friend groups, check-ins
- **Partnerships**: Work with venues for verified data

### Technical Improvements
- **Redis caching**: Faster busyness calculations
- **WebSocket updates**: Real-time map updates
- **A/B testing**: Optimize fusion algorithm
- **Analytics**: Track user behavior and accuracy

---

## 9. API Response Standards

All API endpoints follow consistent patterns:

### Success Response
```typescript
{
  // Data payload varies by endpoint
}
```

### Error Response
```typescript
{
  error: string,        // Human-readable error message
  code?: string,        // Optional error code
  details?: unknown     // Optional additional context
}
```

### HTTP Status Codes
- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource doesn't exist
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

---

## 10. Security Considerations

### Authentication
- App-level passcode for private test
- HTTP-only cookies prevent XSS
- Constant-time comparison prevents timing attacks

### Rate Limiting
- Per-IP limits on report submissions
- Per-browser-token limits for abuse prevention
- Cron endpoint protected with secret token

### Data Privacy
- No personally identifiable information collected
- IP addresses hashed for rate limiting
- Reports are anonymous (no user attribution)

### Database Security
- Supabase handles encryption at rest
- Connection string uses SSL
- Prisma parameterizes queries (SQL injection prevention)

### Environment Variables
- Never commit `.env` to version control
- Store secrets in Vercel dashboard
- Use different values for dev/production

---

## 11. Performance Optimization

### Database
- Indexes on frequently queried fields
- Composite indexes for complex queries
- Cascade deletes to maintain referential integrity

### Caching
- 5-minute cache on fused busyness calculations
- SWR/TanStack Query for client-side caching
- Vercel Edge caching for static assets

### API Efficiency
- Single query to fetch venues with busyness data
- Pagination limits (max 100 venues per request)
- Bounding box queries reduce data transfer

### Map Performance
- Cluster markers when zoomed out
- Lazy load venue details on click
- Optimize marker icons (SVG or small PNGs)

---

## 12. Testing Strategy

### Unit Tests
- Busyness fusion logic
- Date/time utilities
- Level conversion functions

### Integration Tests
- API route handlers
- Database queries (Prisma)
- External API integrations

### E2E Tests (Optional)
- Passcode gate flow
- Report submission
- Map interaction

### Manual Testing Checklist
- [ ] Passcode gate works
- [ ] Map loads with markers
- [ ] Clicking marker shows venue details
- [ ] Submitting report updates busyness
- [ ] Filters work (venue type)
- [ ] Cron job runs successfully
- [ ] Mobile responsive design

---

## 13. Deployment Checklist

Before deploying to production:

- [ ] Environment variables set in Vercel
- [ ] Database schema pushed (`npx prisma db push`)
- [ ] Seed data added (if applicable)
- [ ] `vercel.json` configured for cron
- [ ] Passcode tested and shared with friends
- [ ] Rate limits configured appropriately
- [ ] Error logging enabled
- [ ] Analytics configured (optional)
- [ ] Custom domain connected (optional)
- [ ] SSL certificate active (automatic with Vercel)

---

## 14. Support and Documentation

### For Developers
- Next.js docs: https://nextjs.org/docs
- Prisma docs: https://www.prisma.io/docs
- Leaflet docs: https://leafletjs.com/reference.html
- Vercel docs: https://vercel.com/docs

### For Owner
- Contact developer for technical issues
- Supabase dashboard for database management
- Vercel dashboard for deployment and logs
- This document for architecture reference

---

**Version:** 1.0
**Last Updated:** 2026-01-06
**Author:** Tech Lead / Architect (Agent 1)
