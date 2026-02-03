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

/**
 * Send a message back to Instagram user via Instagram Graph API
 */
async function sendInstagramMessage(recipientId: string, message: string): Promise<boolean> {
  if (!PAGE_ACCESS_TOKEN) {
    console.error('META_PAGE_ACCESS_TOKEN not configured');
    return false;
  }

  // Use Instagram Graph API endpoint for Instagram DMs
  const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

  try {
    // Try Instagram Graph API endpoint first
    let response = await fetch(
      `https://graph.instagram.com/v21.0/me/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAGE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
        }),
      }
    );

    // If that fails, try with the Instagram Account ID
    if (!response.ok && INSTAGRAM_ACCOUNT_ID) {
      console.log('Trying with Instagram Account ID...');
      response = await fetch(
        `https://graph.instagram.com/v21.0/${INSTAGRAM_ACCOUNT_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PAGE_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: message },
          }),
        }
      );
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send Instagram message:', error);
      return false;
    }

    console.log(`Sent Instagram DM to ${recipientId}`);
    return true;
  } catch (error) {
    console.error('Error sending Instagram message:', error);
    return false;
  }
}
