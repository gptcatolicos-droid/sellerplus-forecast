import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { importFromUrl, calculateSellingPrice } from '@/lib/importer';
import { getExchangeRate, getSetting, ensureInit } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  await ensureInit();
  const { url } = await req.json();
  if (!url) return NextResponse.json({ success: false, error: 'URL requerida' }, { status: 400 });

  try {
    const imported = await importFromUrl(url);
    const rates = await getExchangeRate();
    const settingVal = await getSetting('default_margin_percent');
    const marginPercent = parseFloat(settingVal || '25');
    const shippingUsd = 10;

    const sellingPrice = calculateSellingPrice(
      imported.price_original,
      imported.price_original_currency,
      marginPercent,
      shippingUsd,
      rates.usd_to_cop,
    );

    const priceCop = Math.round(sellingPrice * rates.usd_to_cop);

    return NextResponse.json({
      success: true,
      data: {
        ...imported,
        price_selling_usd: sellingPrice,
        price_cop: priceCop,
        margin_percent: marginPercent,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Error al importar' }, { status: 422 });
  }
}
