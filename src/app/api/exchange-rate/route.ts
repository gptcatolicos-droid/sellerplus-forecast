import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await ensureInit();
  const r = await query('SELECT * FROM exchange_rates ORDER BY id DESC LIMIT 1');
  return NextResponse.json({ success: true, data: r.rows[0] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureInit();
  const body = await req.json();

  if (body.manual) {
    await query('UPDATE exchange_rates SET usd_to_cop=$1, usd_to_mxn=$2, usd_to_ars=$3, updated_at=NOW() WHERE id=(SELECT MAX(id) FROM exchange_rates)', [body.usd_to_cop, body.usd_to_mxn, body.usd_to_ars]);
    return NextResponse.json({ success: true });
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const url = apiKey ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD` : 'https://open.er-api.com/v6/latest/USD';
    const res = await fetch(url);
    const data = await res.json();
    const rates = data.conversion_rates || data.rates || {};
    const cop = rates.COP || 4100, mxn = rates.MXN || 17.5, ars = rates.ARS || 900;
    await query('UPDATE exchange_rates SET usd_to_cop=$1, usd_to_mxn=$2, usd_to_ars=$3, updated_at=NOW() WHERE id=(SELECT MAX(id) FROM exchange_rates)', [cop, mxn, ars]);
    await query('UPDATE products SET price_cop = ROUND(price_usd * $1) WHERE true', [cop]);
    return NextResponse.json({ success: true, data: { usd_to_cop: cop, usd_to_mxn: mxn, usd_to_ars: ars } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
