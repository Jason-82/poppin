/**
 * Instagram Messaging Webhook
 *
 * Handles incoming DMs via Meta's Messenger Platform API
 *
 * Setup required:
 * 1. Create Meta Developer App at developers.facebook.com
 * 2. Add Instagram Basic Display and Messenger products
 * 3. Configure webhook URL to this endpoint
 * 4. Set environment variables:
 *    - META_VERIFY_TOKEN: Your chosen verification token
 *    - META_PAGE_ACCESS_TOKEN: Page access token from Meta
 *    - INSTAGRAM_ACCOUNT_ID: Your Instagram business account ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPiaRecommendation } from '@/lib/pia';

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

interface InstagramMessage {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text: string;
  };
}

interface WebhookEntry {
  id: string;
  time: number;
  messaging?: InstagramMessage[];
}

interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

/**
 * GET - Webhook verification (required by Meta)
 */
export async function GET(request: NextRequest) {
  console.log('Instagram webhook GET received');
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('Verification attempt:', { mode, tokenMatch: token === VERIFY_TOKEN, hasChallenge: !!challenge });

  // Verify the webhook
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Instagram webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.log('Instagram webhook verification FAILED');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST - Handle incoming messages
 */
export async function POST(request: NextRequest) {
  console.log('Instagram webhook POST received');

  try {
    const body: WebhookBody = await request.json();
    console.log('Webhook body:', JSON.stringify(body, null, 2));

    // Accept both 'instagram' and 'page' object types
    // Meta sends 'page' for some Messenger Platform webhooks
    if (body.object !== 'instagram' && body.object !== 'page') {
      console.log('Ignoring webhook with object type:', body.object);
      return NextResponse.json({ status: 'ignored' });
    }

    // Process each entry
    for (const entry of body.entry) {
      if (!entry.messaging) continue;

      for (const event of entry.messaging) {
        // Only process text messages
        if (!event.message?.text) continue;

        const senderId = event.sender.id;
        const messageText = event.message.text;

        console.log(`Instagram DM from ${senderId}: ${messageText}`);

        // Get Pia's response
        const piaResponse = await getPiaRecommendation(messageText);

        // Send reply
        await sendInstagramMessage(senderId, piaResponse.message);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Instagram webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

// Cache for Page Access Token (exchanged from System User token)
let cachedPageToken: string | null = null;
let cachedPageTokenExpiry: number = 0;

/**
 * Exchange System User token for Page Access Token
 * System User tokens can access /me/accounts to get Page tokens
 */
async function getPageAccessToken(): Promise<string | null> {
  // Return cached token if still valid (cache for 1 hour)
  if (cachedPageToken && Date.now() < cachedPageTokenExpiry) {
    console.log('Using cached Page Access Token');
    return cachedPageToken;
  }

  if (!PAGE_ACCESS_TOKEN) {
    console.error('META_PAGE_ACCESS_TOKEN not configured');
    return null;
  }

  const PAGE_ID = process.env.META_PAGE_ID || '912069145331385';

  console.log('Exchanging System User token for Page Access Token...');

  try {
    // Get Page Access Token from System User token
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=access_token&access_token=${PAGE_ACCESS_TOKEN}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        console.log('Successfully got Page Access Token');
        cachedPageToken = data.access_token;
        cachedPageTokenExpiry = Date.now() + 3600000; // 1 hour
        return cachedPageToken;
      }
    }

    const error = await response.text();
    console.error('Failed to get Page Access Token:', error);

    // Fallback: try using the original token (in case it's already a Page token)
    console.log('Falling back to original token');
    return PAGE_ACCESS_TOKEN;
  } catch (e) {
    console.error('Error exchanging token:', e);
    return PAGE_ACCESS_TOKEN;
  }
}

/**
 * Send a message back to Instagram user
 * Tries multiple endpoint formats to find the one that works
 */
async function sendInstagramMessage(recipientId: string, message: string): Promise<boolean> {
  const pageToken = await getPageAccessToken();

  if (!pageToken) {
    console.error('No access token available');
    return false;
  }

  const PAGE_ID = process.env.META_PAGE_ID || '912069145331385';
  const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

  console.log('=== SEND MESSAGE DEBUG ===');
  console.log('Recipient ID:', recipientId);
  console.log('Page ID:', PAGE_ID);
  console.log('Instagram Account ID:', IG_ACCOUNT_ID || 'not set');
  console.log('Using Page Token (first 20 chars):', pageToken?.substring(0, 20) + '...');

  const payload = {
    recipient: { id: recipientId },
    message: { text: message },
    messaging_type: 'RESPONSE',
  };

  // Try approach 1: Instagram Business Account ID (if set)
  if (IG_ACCOUNT_ID) {
    console.log('Trying Instagram Account ID endpoint...');
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}/messages?access_token=${pageToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) {
        console.log(`SUCCESS via Instagram Account ID! Sent DM to ${recipientId}`);
        return true;
      }
      const error = await response.text();
      console.error('Instagram Account ID approach failed:', error);
    } catch (e) {
      console.error('Instagram Account ID approach error:', e);
    }
  }

  // Try approach 2: Page ID
  console.log('Trying Page ID endpoint...');
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/messages?access_token=${pageToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (response.ok) {
      console.log(`SUCCESS via Page ID! Sent DM to ${recipientId}`);
      return true;
    }
    const error = await response.text();
    console.error('Page ID approach failed:', error);
  } catch (e) {
    console.error('Page ID approach error:', e);
  }

  // Try approach 3: Direct recipient endpoint (some APIs use this)
  console.log('Trying direct messages endpoint...');
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (response.ok) {
      console.log(`SUCCESS via /me/messages! Sent DM to ${recipientId}`);
      return true;
    }
    const error = await response.text();
    console.error('/me/messages approach failed:', error);
  } catch (e) {
    console.error('/me/messages approach error:', e);
  }

  console.log('All approaches failed');
  return false;
}
