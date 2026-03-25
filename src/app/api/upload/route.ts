import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '5') * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  if (!files.length) {
    return NextResponse.json({ success: false, error: 'No se recibieron archivos' }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const uploaded: { url: string; original_name: string }[] = [];

  for (const file of files.slice(0, 10)) { // Max 10
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: `Archivo ${file.name} supera el límite de ${MAX_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ success: false, error: `Formato no permitido: ${ext}` }, { status: 400 });
    }

    const filename = `${uuid()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    uploaded.push({ url, original_name: file.name });
  }

  return NextResponse.json({ success: true, data: uploaded });
}
