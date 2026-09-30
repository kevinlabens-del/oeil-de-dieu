import { NextResponse } from 'next/server';
import { getGeminiApiKeys } from '@/lib/ai-engine';
import { version } from '../../../../package.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    platform: 'ŒIL DE DIEU',
    version,
    capabilities: {
      scanner: Boolean(process.env.SCANNER_URL && process.env.SCANNER_KEY),
      maritimeLive: Boolean(process.env.AIS_API_KEY),
      ai: getGeminiApiKeys().length > 0,
    },
    uptime: process.uptime ? Math.round(process.uptime()) : 0,
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/flights',
      '/api/satellites',
      '/api/earthquakes',
      '/api/news',
      '/api/gdelt',
      '/api/markets',
      '/api/frontlines',
      '/api/region-dossier',
    ],
  });
}
