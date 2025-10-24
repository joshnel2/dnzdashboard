import type { VercelRequest, VercelResponse } from '@vercel/node';

function redact(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = Array.isArray(value) ? [] as unknown as Record<string, unknown> : {};
  for (const [k, v] of Object.entries(input)) {
    const keyLower = k.toLowerCase();
    if (keyLower.includes('token') || keyLower === 'authorization' || keyLower === 'access_token' || keyLower === 'refresh_token') {
      out[k] = '***REDACTED***';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, info: 'POST logs to this endpoint' });
  }

  let payload: any = {};
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_e) {
    payload = { parseError: true };
  }

  const level: 'info' | 'warn' | 'error' = payload.level || 'info';
  const source = payload.source || 'client';
  const message = payload.message || 'log';
  const context = redact(payload.context || {});
  const meta = {
    ip: (req.headers['x-forwarded-for'] as string) || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    referer: req.headers['referer'] || 'unknown',
    ts: new Date().toISOString(),
  };

  const entry = { source, message, context, ...meta };

  try {
    if (level === 'error') {
      console.error('[CLIO][client-log]', entry);
    } else if (level === 'warn') {
      console.warn('[CLIO][client-log]', entry);
    } else {
      console.info('[CLIO][client-log]', entry);
    }
  } catch (_e) {
    // ignore console failures
  }

  return res.status(200).json({ ok: true });
}
