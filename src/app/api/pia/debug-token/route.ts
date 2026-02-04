/**
 * Debug endpoint to test Meta tokens and permissions
 *
 * GET /api/pia/debug-token - Test current token
 * GET /api/pia/debug-token?token=xxx - Test a specific token
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const testToken = request.nextUrl.searchParams.get('token') || process.env.META_PAGE_ACCESS_TOKEN;

  if (!testToken) {
    return NextResponse.json({
      error: 'No token provided and META_PAGE_ACCESS_TOKEN not set',
      hint: 'Pass ?token=YOUR_TOKEN or set META_PAGE_ACCESS_TOKEN env var'
    }, { status: 400 });
  }

  const results: Record<string, unknown> = {
    tokenPreview: testToken.substring(0, 20) + '...',
    timestamp: new Date().toISOString(),
  };

  // Test 1: Debug token info
  try {
    const debugResponse = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${testToken}&access_token=${testToken}`
    );
    results.tokenDebug = await debugResponse.json();
  } catch (e) {
    results.tokenDebug = { error: String(e) };
  }

  // Test 2: Get /me info (what identity does this token represent?)
  try {
    const meResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${testToken}`
    );
    results.meEndpoint = await meResponse.json();
  } catch (e) {
    results.meEndpoint = { error: String(e) };
  }

  // Test 3: Get /me/accounts (pages this token can access)
  try {
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${testToken}`
    );
    results.pages = await accountsResponse.json();
  } catch (e) {
    results.pages = { error: String(e) };
  }

  // Test 4: Check Instagram Business Account linked to page
  const pageId = process.env.META_PAGE_ID || '912069145331385';
  try {
    const igResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${testToken}`
    );
    results.instagramAccount = await igResponse.json();
  } catch (e) {
    results.instagramAccount = { error: String(e) };
  }

  // Test 5: Check token permissions
  try {
    const permResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${testToken}`
    );
    results.permissions = await permResponse.json();
  } catch (e) {
    results.permissions = { error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
