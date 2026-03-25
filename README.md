# La Tienda de Comics — Guía de instalación

## Stack técnico
- **Framework**: Next.js 14 (App Router)
- **Base de datos**: SQLite (better-sqlite3) — sin servidor externo
- **Pagos**: MercadoPago
- **Email**: Resend (3,000/mes gratis)
- **IA**: Claude (Anthropic)
- **Servidor**: Hetzner CX32 (~$9 USD/mes)
- **Hosting Web**: Nginx + PM2

---

## Instalación local (desarrollo)

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Edita .env con tus claves

# 3. Ejecutar en desarrollo
npm run dev

# Abre: http://localhost:3000
# Admin: http://localhost:3000/admin
```

---

## Deploy en Hetzner CX32

### Paso 1 — Crear servidor
1. Ve a [hetzner.com](https://www.hetzner.com/cloud)
2. Crea servidor CX32 · Ubuntu 24.04 · Ashburn Virginia
3. Agrega tu clave SSH

### Paso 2 — Subir código
```bash
# Desde tu máquina local:
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' \
  ./ root@TU_IP_HETZNER:/var/www/latiendadecomics/
```

### Paso 3 — Ejecutar deploy
```bash
ssh root@TU_IP_HETZNER
cd /var/www/latiendadecomics
bash deploy.sh
```

### Paso 4 — Configurar credenciales
```bash
nano /var/www/latiendadecomics/.env
# Completa TODAS las variables reales
pm2 restart all
```

### Paso 5 — DNS (en GoDaddy)
1. Ve a tu dominio en GoDaddy
2. DNS → Administrar
3. Edita el registro A:
   - Tipo: A
   - Nombre: @
   - Valor: TU_IP_HETZNER
4. Agrega otro A:
   - Nombre: www
   - Valor: TU_IP_HETZNER

### Paso 6 — SSL (después de que el DNS propague, ~5-30 min)
```bash
ssh root@TU_IP_HETZNER
certbot --nginx -d latiendadecomics.com -d www.latiendadecomics.com
```

---

## Variables de entorno necesarias

| Variable | Dónde obtenerla |
|---|---|
| `MP_ACCESS_TOKEN` | [mercadopago.com.co/developers](https://www.mercadopago.com.co/developers/) |
| `MP_PUBLIC_KEY` | Mismo panel de MercadoPago |
| `RESEND_API_KEY` | [resend.com](https://resend.com) — gratis |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `JWT_SECRET` | `openssl rand -base64 64` en terminal |
| `ADMIN_EMAIL` | Tu email de admin |
| `ADMIN_PASSWORD` | Tu contraseña de admin |

---

## Comandos útiles en producción

```bash
pm2 status          # Ver estado de la app
pm2 logs            # Ver logs en tiempo real
pm2 restart all     # Reiniciar (después de cambios en .env)
pm2 monit           # Monitor de CPU/RAM

# Ver errores
pm2 logs --err

# Rebuild después de actualizar código
cd /var/www/latiendadecomics
npm run build && pm2 restart all
```

---

## Estructura del proyecto

```
src/
  app/
    page.tsx              ← Homepage (AI chat + productos)
    catalogo/             ← Catálogo con filtros
    producto/[slug]/      ← Página de producto
    carrito/              ← Carrito de compras
    checkout/             ← Proceso de pago
    confirmacion/[id]/    ← Confirmación de pedido
    admin/                ← Panel admin (protegido)
      login/
      productos/
      pedidos/
      cupones/
      configuracion/
    api/
      products/           ← CRUD productos + bulk
      orders/             ← Gestión pedidos + tracking
      coupons/            ← Cupones de descuento
      payments/webhook/   ← Webhook MercadoPago
      ai/                 ← Chat + SEO + descripciones
      import/             ← URL Importer
      auth/               ← Login/logout admin
      exchange-rate/      ← Tasas de cambio
      upload/             ← Subida de imágenes
  lib/
    db.ts                 ← SQLite + schema
    email.ts              ← Emails (Resend)
    mercadopago.ts        ← Pagos
    ai.ts                 ← Claude AI
    importer.ts           ← Scraping 4 proveedores
    auth.ts               ← JWT + cookies
  components/
    layout/Navbar.tsx
    product/ProductCard.tsx
    product/ProductBuyBox.tsx
    product/ProductImages.tsx
    ai/AIChat.tsx
  hooks/
    useCart.tsx           ← Estado del carrito (localStorage)
```

---

## Panel Admin

URL: `https://latiendadecomics.com/admin`

| Módulo | Función |
|---|---|
| Dashboard | Ventas, pedidos pendientes, stock bajo |
| Productos | Listar, editar precios inline, stock inline, toggle preventa |
| Nuevo producto | URL Importer + formulario completo + IA |
| Pedidos | Lista + detalle + tracking + notificación email |
| Cupones | Crear/desactivar cupones de descuento |
| Configuración | Credenciales, tarifas, tasas de cambio |

---

## Proveedores soportados (URL Importer)

| Proveedor | Método | Dificultad |
|---|---|---|
| Iron Studios | Shopify JSON | ⭐ Muy fácil |
| Panini Colombia | Shopify JSON | ⭐ Muy fácil |
| Midtown Comics | HTML scrape | ⭐⭐ Media |
| Amazon | Product API / HTML | ⭐⭐ Media |

---

## Costos mensuales estimados

| Servicio | Costo |
|---|---|
| Hetzner CX32 | ~$9 USD |
| Resend email | $0 (3k/mes gratis) |
| Claude API | ~$5–15 USD |
| GoDaddy dominio | ~$2 USD |
| **Total** | **~$16–26 USD/mes** |
