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
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const userId: string = (session.user as any).id ?? session.user.email!;

  await Promise.all([
    supabase.from('user_settings').delete().eq('user_id', userId),
    supabase.from('user_logs').delete().eq('user_id', userId),
    supabase.from('profiles').delete().eq('email', session.user.email!),
  ]);

  return res.json({ ok: true });
}
