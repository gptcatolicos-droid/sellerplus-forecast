import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { generateSeoData, generateDescription, generateDescriptionEn, generateAltText, generateBlogArticle, chatAboutProduct } from '@/lib/ai';
import { ensureInit } from '@/lib/db';

export async function POST(req: NextRequest) {
  await ensureInit();
  const body = await req.json();
  const { action } = body;

  // Product chat is public (used on product page)
  if (action === 'chat_product') {
    const { product, message } = body;
    if (!product || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const text = await chatAboutProduct(product, message);
    return NextResponse.json({ success: true, data: { text } });
  }

  // All other actions require admin
  const auth = await requireAdmin(req);
  if (auth) return auth;

  if (action === 'generate_seo') {
    const data = await generateSeoData(body.product);
    return NextResponse.json({ success: true, data });
  }

  if (action === 'generate_description') {
    const text = await generateDescription(body.product);
    return NextResponse.json({ success: true, data: { text } });
  }

  if (action === 'generate_description_en') {
    const text = await generateDescriptionEn(body.spanish_description);
    return NextResponse.json({ success: true, data: { text } });
  }

  if (action === 'generate_alt_text') {
    const text = await generateAltText(body.product_title, body.image_index || 0);
    return NextResponse.json({ success: true, data: { text } });
  }

  if (action === 'generate_blog') {
    const text = await generateBlogArticle(body.topic, body.keywords || []);
    return NextResponse.json({ success: true, data: { text } });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
