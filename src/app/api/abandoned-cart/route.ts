import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, name, items, cartId } = await req.json();
    if (!email || !items?.length) return NextResponse.json({ success: false });

    const itemsHtml = items.slice(0, 3).map((item: any) => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0;align-items:center">
        ${item.image_url ? `<img src="${item.image_url}" style="width:48px;height:64px;object-fit:cover;border-radius:6px;flex-shrink:0" alt="">` : '<div style="width:48px;height:64px;background:#F7F7F7;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px">📚</div>'}
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:#111;margin-bottom:4px">${item.title?.slice(0, 60)}</div>
          <div style="font-size:12px;color:#999">${item.supplier || 'La Tienda de Comics'}</div>
          <div style="font-size:14px;font-weight:700;color:#CC0000;margin-top:4px">$${parseFloat(item.price_usd).toFixed(2)} USD</div>
        </div>
      </div>`).join('');

    const recoveryUrl = `https://latiendadecomics.com?cart=${cartId}`;

    await resend.emails.send({
      from: 'La Tienda de Comics <pedidos@latiendadecomics.com>',
      to: email,
      subject: `${name ? name + ', ¿o' : '¿O'}lvidaste algo en tu carrito? 🛒`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#F7F7F7;padding:32px 16px">
          <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)">
            <div style="background:#0D0D0D;padding:24px 32px;text-align:center">
              <p style="color:white;font-size:20px;font-weight:700;margin:0">La Tienda de <span style="color:#CC0000">Comics</span></p>
            </div>
            <div style="padding:32px">
              <h2 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#111">¡Casi lo tienes! 🎉</h2>
              <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">
                ${name ? `Hola ${name}, dejaste` : 'Dejaste'} estos productos en tu carrito. ¡Completa tu compra antes de que se agoten!
              </p>
              ${itemsHtml}
              <a href="${recoveryUrl}" style="display:block;background:#CC0000;color:white;padding:16px 28px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;text-align:center;margin:24px 0 12px">
                Completar mi compra →
              </a>
              <p style="font-size:12px;color:#999;text-align:center;margin:0">
                Tu carrito se guardará por 7 días · Envío a Colombia y LATAM
              </p>
            </div>
            <div style="padding:16px 32px;border-top:1px solid #E8E8E8;font-size:11px;color:#999;text-align:center">
              © La Tienda de Comics · <a href="mailto:hola@latiendadecomics.com" style="color:#CC0000">hola@latiendadecomics.com</a>
            </div>
          </div>
        </div>`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
