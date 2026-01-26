/**
 * GET/POST /api/pia/recommend
 *
 * Get Pia's recommendation for a neighborhood or general query
 *
 * Query params (GET) or body (POST):
 * - message: User's question (e.g., "what's hot in wicker park?")
 * - neighborhood: Optional specific neighborhood to query
 *
 * Returns:
 * - message: Pia's response text
 * - recommendations: Array of venue recommendations with busyness data
 * - neighborhood: Detected or specified neighborhood
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPiaRecommendation,
  getTopVenues,
  extractNeighborhood,
  generatePiaResponse,
  CHICAGO_NEIGHBORHOODS,
} from '@/lib/pia';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const message = searchParams.get('message') || searchParams.get('q');
  const neighborhood = searchParams.get('neighborhood');

  // If just asking for a neighborhood without a message
  if (neighborhood && !message) {
    try {
      const recommendations = await getTopVenues(neighborhood, 5);
      const piaMessage = await generatePiaResponse(
        `What's happening in ${neighborhood}?`,
        recommendations,
        neighborhood
      );

      return NextResponse.json({
        message: piaMessage,
        recommendations,
        neighborhood,
      });
    } catch (error) {
      console.error('Error in /api/pia/recommend:', error);
      return NextResponse.json(
        { error: 'Failed to get recommendations' },
        { status: 500 }
      );
    }
  }

  // Need either message or neighborhood
  if (!message) {
    return NextResponse.json(
      {
        error: 'Missing message or neighborhood parameter',
        example: '/api/pia/recommend?message=whats%20hot%20in%20river%20north',
        neighborhoods: CHICAGO_NEIGHBORHOODS,
      },
      { status: 400 }
    );
  }

  try {
    const result = await getPiaRecommendation(message);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/pia/recommend:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, neighborhood } = body;

    if (!message && !neighborhood) {
      return NextResponse.json(
        { error: 'Missing message or neighborhood in request body' },
        { status: 400 }
      );
    }

    // If neighborhood provided directly, use it
    const detectedNeighborhood = neighborhood || (message ? extractNeighborhood(message) : null);

    const recommendations = await getTopVenues(detectedNeighborhood, 5);
    const piaMessage = await generatePiaResponse(
      message || `What's happening in ${neighborhood}?`,
      recommendations,
      detectedNeighborhood
    );

    return NextResponse.json({
      message: piaMessage,
      recommendations,
      neighborhood: detectedNeighborhood,
    });
  } catch (error) {
    console.error('Error in /api/pia/recommend:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
