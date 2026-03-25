import { Resend } from 'resend';
import type { Order } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_TRANSACTIONAL = 'La Tienda de Comics <pedidos@latiendadecomics.com>';
const FROM_CONTACT = 'La Tienda de Comics <hola@latiendadecomics.com>';
const SITE = 'https://latiendadecomics.com';

// ── EMAIL STYLES ──────────────────────────────
const styles = {
  body: 'font-family: DM Sans, Arial, sans-serif; background: #F7F7F7; margin: 0; padding: 32px 16px;',
  container: 'max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,.08);',
  header: 'background: #0D0D0D; padding: 24px 32px; text-align: center;',
  headerTitle: 'color: white; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: .02em;',
  headerRed: 'color: #CC0000;',
  body_inner: 'padding: 32px;',
  h2: 'font-size: 20px; font-weight: 700; margin: 0 0 8px; color: #111;',
  p: 'font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px;',
  orderBox: 'background: #F7F7F7; border-radius: 12px; padding: 20px; margin: 20px 0;',
  row: 'display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #E8E8E8;',
  total: 'display: flex; justify-content: space-between; padding: 12px 0 0; font-size: 16px; font-weight: 700;',
  btn: 'display: inline-block; background: #CC0000; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 16px 0;',
  footer: 'padding: 20px 32px; border-top: 1px solid #E8E8E8; font-size: 11px; color: #999; text-align: center; line-height: 1.6;',
};

function orderItemsHtml(order: Order) {
  return order.items.map(item => `
    <div style="${styles.row}">
      <span style="color:#555">${item.product_title} × ${item.quantity}</span>
      <span style="color:#111;font-weight:600">$${(item.price_usd * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');
}

// ── 1. ORDER CONFIRMATION ─────────────────────
export async function sendOrderConfirmation(order: Order) {
  const html = `
    <div style="${styles.body}">
      <div style="${styles.container}">
        <div style="${styles.header}">
          <p style="${styles.headerTitle}">La Tienda de <span style="${styles.headerRed}">Comics</span></p>
        </div>
        <div style="${styles.body_inner}">
          <h2 style="${styles.h2}">¡Pedido confirmado! 🎉</h2>
          <p style="${styles.p}">Hola ${order.customer.name}, recibimos tu pedido y ya estamos gestionando tu compra.</p>

          <div style="${styles.orderBox}">
            <p style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px">Pedido ${order.order_number}</p>
            ${orderItemsHtml(order)}
            <div style="border-top:1px solid #E8E8E8;margin-top:8px">
              <div style="${styles.row}"><span>Envío</span><span>$${order.shipping_usd.toFixed(2)}</span></div>
              ${order.discount_usd > 0 ? `<div style="${styles.row}"><span>Descuento</span><span>-$${order.discount_usd.toFixed(2)}</span></div>` : ''}
              <div style="${styles.total}"><span>Total</span><span style="color:#CC0000">$${order.total_usd.toFixed(2)} USD</span></div>
            </div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:20px">
            <p style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px">📦 Tiempo de entrega estimado</p>
            <p style="font-size:13px;color:#3b82f6;margin:0">${order.shipping_zone === 'colombia' ? '6 – 10 días hábiles a Colombia' : '8 – 15 días hábiles (internacional)'}</p>
          </div>

          <p style="${styles.p}">Te enviaremos otro email con el número de tracking cuando despachemos. Si tienes preguntas escríbenos a <a href="mailto:hola@latiendadecomics.com" style="color:#CC0000">hola@latiendadecomics.com</a></p>

          <a href="${SITE}" style="${styles.btn}">Seguir buscando →</a>
        </div>
        <div style="${styles.footer}">
          © La Tienda de Comics · Bogotá, Colombia<br>
          <a href="mailto:hola@latiendadecomics.com" style="color:#CC0000">hola@latiendadecomics.com</a>
        </div>
      </div>
    </div>`;

  return resend.emails.send({
    from: FROM_TRANSACTIONAL,
    to: order.customer.email,
    subject: `✅ Pedido ${order.order_number} confirmado — La Tienda de Comics`,
    html,
  });
}

// ── 2. TRACKING NOTIFICATION ──────────────────
export async function sendTrackingNotification(order: Order) {
  const html = `
    <div style="${styles.body}">
      <div style="${styles.container}">
        <div style="${styles.header}">
          <p style="${styles.headerTitle}">La Tienda de <span style="${styles.headerRed}">Comics</span></p>
        </div>
        <div style="${styles.body_inner}">
          <h2 style="${styles.h2}">¡Tu pedido está en camino! 🚀</h2>
          <p style="${styles.p}">Hola ${order.customer.name}, tu pedido <strong>${order.order_number}</strong> fue despachado.</p>

          <div style="${styles.orderBox}">
            <p style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Número de tracking</p>
            <p style="font-size:22px;font-weight:700;color:#111;margin:0;letter-spacing:.05em">${order.tracking_number}</p>
            <p style="font-size:12px;color:#999;margin:4px 0 0">Transportista: ${order.tracking_carrier || 'USPS'}</p>
          </div>

          <p style="${styles.p}">Puedes rastrear tu paquete en el sitio web de ${order.tracking_carrier || 'USPS'} con el número de tracking de arriba. Tiempo estimado de entrega: ${order.shipping_zone === 'colombia' ? '6–10' : '8–15'} días hábiles desde el despacho.</p>

          <p style="${styles.p}">¿Preguntas? Escríbenos a <a href="mailto:hola@latiendadecomics.com" style="color:#CC0000">hola@latiendadecomics.com</a></p>
        </div>
        <div style="${styles.footer}">
          © La Tienda de Comics · Bogotá, Colombia<br>
          <a href="mailto:hola@latiendadecomics.com" style="color:#CC0000">hola@latiendadecomics.com</a>
        </div>
      </div>
    </div>`;

  return resend.emails.send({
    from: FROM_TRANSACTIONAL,
    to: order.customer.email,
    subject: `🚀 Tu pedido ${order.order_number} está en camino — tracking incluido`,
    html,
  });
}

// ── 3. PREVENTA READY ─────────────────────────
export async function sendPreventaReadyNotification(order: Order) {
  const html = `
    <div style="${styles.body}">
      <div style="${styles.container}">
        <div style="${styles.header}">
          <p style="${styles.headerTitle}">La Tienda de <span style="${styles.headerRed}">Comics</span></p>
        </div>
        <div style="${styles.body_inner}">
          <h2 style="${styles.h2}">¡Tu preventa llegó! 🎊</h2>
          <p style="${styles.p}">Hola ${order.customer.name}, el producto de tu preventa ya está disponible y listo para despachar.</p>
          <p style="${styles.p}">Nos pondremos en contacto pronto para coordinar el pago del saldo pendiente y el despacho.</p>
          <p style="${styles.p}">¿Preguntas? Escríbenos a <a href="mailto:hola@latiendadecomics.com" style="color:#CC0000">hola@latiendadecomics.com</a></p>
        </div>
        <div style="${styles.footer}">
          © La Tienda de Comics · Bogotá, Colombia
        </div>
      </div>
    </div>`;

  return resend.emails.send({
    from: FROM_TRANSACTIONAL,
    to: order.customer.email,
    subject: `🎊 Tu preventa llegó — ${order.order_number}`,
    html,
  });
}

// ── 4. CONTACT FORM (from customers) ─────────
export async function sendContactEmail({
  name, email, message,
}: { name: string; email: string; message: string }) {
  return resend.emails.send({
    from: FROM_CONTACT,
    to: 'hola@latiendadecomics.com',
    replyTo: email,
    subject: `📬 Mensaje de ${name} — La Tienda de Comics`,
    html: `
      <div style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.header}">
            <p style="${styles.headerTitle}">Nuevo mensaje de cliente</p>
          </div>
          <div style="${styles.body_inner}">
            <p style="${styles.p}"><strong>Nombre:</strong> ${name}</p>
            <p style="${styles.p}"><strong>Email:</strong> <a href="mailto:${email}" style="color:#CC0000">${email}</a></p>
            <p style="${styles.p}"><strong>Mensaje:</strong></p>
            <div style="background:#F7F7F7;border-radius:10px;padding:16px;font-size:14px;color:#333;line-height:1.6">${message}</div>
          </div>
        </div>
      </div>`,
  });
}
