import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from './auth/[...nextauth]';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const userId: string = (session.user as any).id ?? session.user.email!;

  if (req.method === 'GET') {
    const [{ data: settingsRow }, { data: logsRow }] = await Promise.all([
      supabase.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
      supabase.from('user_logs').select('data').eq('user_id', userId).maybeSingle(),
    ]);
    return res.json({
      settings: settingsRow?.data ?? null,
      logs:     logsRow?.data ?? null,
    });
  }

  if (req.method === 'POST') {
    const { settings, logs } = req.body ?? {};
    const now = new Date().toISOString();

    await Promise.all([
      settings !== undefined
        ? supabase.from('user_settings').upsert({ user_id: userId, data: settings, updated_at: now }, { onConflict: 'user_id' })
        : Promise.resolve(),
      logs !== undefined
        ? supabase.from('user_logs').upsert({ user_id: userId, data: logs, updated_at: now }, { onConflict: 'user_id' })
        : Promise.resolve(),
    ]);

    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
