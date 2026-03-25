import { NextRequest, NextResponse } from 'next/server';
import { query, ensureInit } from '@/lib/db';
import { createToken, verifyPassword, setAuthCookie, clearAuthCookie, hashPassword, verifyToken } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@latiendadecomics.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LTC@Admin2026!';

async function ensureAdmin() {
  await ensureInit();
  const r = await query('SELECT id FROM admin_users LIMIT 1');
  if (r.rows.length === 0) {
    const hashed = await hashPassword(ADMIN_PASSWORD);
    await query(
      'INSERT INTO admin_users (id, email, password, name) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING',
      [uuid(), ADMIN_EMAIL, hashed, 'Admin']
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, action } = body;

    if (action === 'logout') {
      const res = NextResponse.json({ success: true });
      clearAuthCookie(res);
      return res;
    }

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email y contrasena requeridos' }, { status: 400 });
    }

    await ensureAdmin();

    const r = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
    const admin = r.rows[0];

    if (!admin) {
      return NextResponse.json({ success: false, error: 'Credenciales invalidas' }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.password);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Credenciales invalidas' }, { status: 401 });
    }

    const token = await createToken({ id: admin.id, email: admin.email });
    const res = NextResponse.json({ success: true, data: { name: admin.name, email: admin.email } });
    setAuthCookie(res, token);
    return res;
  } catch (err: any) {
    console.error('Auth POST error:', err?.message);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('ltc_admin_token')?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false }, { status: 401 });
    return NextResponse.json({ success: true, data: session });
  } catch {
    return NextResponse.json({ success: false }, { status: 401 });
  }
}
