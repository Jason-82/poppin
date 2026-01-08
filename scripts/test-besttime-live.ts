/**
 * Test script to check what BestTime's /forecast/live endpoint returns
 * Run with: npx tsx scripts/test-besttime-live.ts
 */

const API_KEY = process.env.BESTTIME_API_KEY;
const GIBSON_VENUE_ID = 'ven_4564324a32747a3665493152673444544831356e6e57494a496843';

async function testLiveEndpoint() {
  if (!API_KEY) {
    console.error('BESTTIME_API_KEY not set. Run with:');
    console.error('BESTTIME_API_KEY=your_key npx tsx scripts/test-besttime-live.ts');
    process.exit(1);
  }

  const url = `https://besttime.app/api/v1/forecast/live?api_key_private=${API_KEY}&venue_id=${GIBSON_VENUE_ID}`;

  console.log('Fetching live data for Gibson\'s...');
  console.log(`URL: ${url.replace(API_KEY, 'REDACTED')}\n`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log('=== RAW RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== KEY FIELDS ===');
    if (data.analysis) {
      console.log(`venue_live_busyness: ${data.analysis.venue_live_busyness}`);
      console.log(`venue_live_busyness_available: ${data.analysis.venue_live_busyness_available}`);
      console.log(`venue_forecasted_busyness: ${data.analysis.venue_forecasted_busyness}`);
    } else {
      console.log('No analysis field in response');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testLiveEndpoint();
