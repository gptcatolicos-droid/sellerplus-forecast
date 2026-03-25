#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DEPLOY — La Tienda de Comics
# Servidor: Hetzner CX32 · Ubuntu 24.04
# Ejecutar como: bash deploy.sh
# ═══════════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "════════════════════════════════════════════"
echo "   La Tienda de Comics — Deploy Script"
echo "════════════════════════════════════════════"
echo ""

# ── 1. SYSTEM UPDATE ──────────────────────────
log "Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. NODE.JS 20 ─────────────────────────────
log "Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs > /dev/null 2>&1
log "Node $(node --version) · npm $(npm --version)"

# ── 3. PM2 ────────────────────────────────────
log "Instalando PM2..."
npm install -g pm2 > /dev/null 2>&1

# ── 4. NGINX ──────────────────────────────────
log "Instalando Nginx..."
apt-get install -y nginx > /dev/null 2>&1

# ── 5. CERTBOT ────────────────────────────────
log "Instalando Certbot..."
apt-get install -y certbot python3-certbot-nginx > /dev/null 2>&1

# ── 6. GIT ────────────────────────────────────
log "Instalando Git..."
apt-get install -y git > /dev/null 2>&1

# ── 7. PLAYWRIGHT DEPS (for Midtown scraping) ─
log "Instalando dependencias de Playwright..."
apt-get install -y \
  libgbm-dev libnss3 libatk-bridge2.0-0 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libpango-1.0-0 libcairo2 > /dev/null 2>&1

# ── 8. APP DIRECTORY ──────────────────────────
APP_DIR="/var/www/latiendadecomics"
log "Creando directorio de aplicación: $APP_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/public/uploads"
mkdir -p "$APP_DIR/public/images"

# ── 9. COPY FILES ─────────────────────────────
warn "Copiando archivos del proyecto..."
warn "Asegúrate de haber subido los archivos a: $APP_DIR"
warn "Comando para subir: rsync -avz ./latiendadecomics/ root@TU_IP:$APP_DIR/"

# ── 10. ENV FILE ──────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  warn "⚠️  NO se encontró .env — creando desde template..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env" 2>/dev/null || cat > "$APP_DIR/.env" << 'ENV_EOF'
NEXT_PUBLIC_SITE_URL=https://latiendadecomics.com
NEXT_PUBLIC_SITE_NAME=La Tienda de Comics
DATABASE_PATH=./data/store.db
JWT_SECRET=CHANGE_THIS_NOW_USE_openssl_rand_-base64_64
ADMIN_EMAIL=admin@latiendadecomics.com
ADMIN_PASSWORD=CHANGE_THIS_BEFORE_LAUNCH
MP_ACCESS_TOKEN=APP_USR-YOUR_TOKEN_HERE
MP_PUBLIC_KEY=APP_USR-YOUR_KEY_HERE
MP_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
RESEND_API_KEY=re_YOUR_KEY_HERE
EMAIL_FROM=pedidos@latiendadecomics.com
EMAIL_FROM_NAME=La Tienda de Comics
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
EXCHANGE_RATE_API_KEY=YOUR_KEY_HERE
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE_MB=5
ENV_EOF
  warn ""
  warn "🔑 IMPORTANTE: Edita $APP_DIR/.env con tus credenciales reales"
  warn "   nano $APP_DIR/.env"
  warn ""
fi

# ── 11. INSTALL DEPENDENCIES ──────────────────
log "Instalando dependencias npm..."
cd "$APP_DIR"
npm install --production=false 2>&1 | tail -3

# ── 12. BUILD ─────────────────────────────────
log "Compilando Next.js (puede tardar 2-3 minutos)..."
npm run build 2>&1 | tail -10

# ── 13. PM2 ECOSYSTEM ─────────────────────────
log "Configurando PM2..."
cat > "$APP_DIR/ecosystem.config.js" << 'PM2_EOF'
module.exports = {
  apps: [{
    name: 'latiendadecomics',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    cwd: '/var/www/latiendadecomics',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production', PORT: 3000 },
    error_file: '/var/log/ltc/error.log',
    out_file: '/var/log/ltc/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    autorestart: true,
    watch: false,
  }]
};
PM2_EOF

mkdir -p /var/log/ltc
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash 2>/dev/null || true
log "PM2 configurado"

# ── 14. NGINX ─────────────────────────────────
log "Configurando Nginx..."
cat > /etc/nginx/sites-available/latiendadecomics << 'NGINX_EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name latiendadecomics.com www.latiendadecomics.com;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name latiendadecomics.com www.latiendadecomics.com;

    # SSL (Certbot will fill these)
    ssl_certificate /etc/letsencrypt/live/latiendadecomics.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/latiendadecomics.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Uploads max size
    client_max_body_size 10M;

    # Static files (served directly by Nginx for speed)
    location /_next/static/ {
        alias /var/www/latiendadecomics/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias /var/www/latiendadecomics/public/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    location /images/ {
        alias /var/www/latiendadecomics/public/images/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Next.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/latiendadecomics /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
log "Nginx configurado"

# ── 15. FIREWALL ──────────────────────────────
log "Configurando firewall..."
ufw --force enable > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 'Nginx Full' > /dev/null 2>&1
log "Firewall: SSH + HTTP/HTTPS habilitados"

# ── 16. SSL CERT (after DNS is pointing to server) ─
warn ""
warn "════════════════════════════════════════════"
warn "SSL: Una vez que el DNS apunte a este servidor, ejecuta:"
warn "certbot --nginx -d latiendadecomics.com -d www.latiendadecomics.com"
warn "════════════════════════════════════════════"

# ── 17. SUMMARY ───────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ Deploy completado${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "  App:     http://$(curl -s ifconfig.me 2>/dev/null || echo 'TU_IP'):3000"
echo "  Admin:   http://$(curl -s ifconfig.me 2>/dev/null || echo 'TU_IP'):3000/admin"
echo ""
echo "  📋 Próximos pasos:"
echo "  1. Editar credenciales:  nano $APP_DIR/.env"
echo "  2. Reiniciar app:        pm2 restart all"
echo "  3. Configurar DNS:       Apunta A record a $(curl -s ifconfig.me 2>/dev/null || echo 'TU_IP')"
echo "  4. Instalar SSL:         certbot --nginx -d latiendadecomics.com"
echo "  5. Panel admin:          /admin (usuario desde .env)"
echo ""
echo "  📊 Monitoreo:    pm2 monit"
echo "  📜 Logs:         pm2 logs"
echo "  🔄 Restart:      pm2 restart all"
echo ""
