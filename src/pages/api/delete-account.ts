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
  const email: string = session.user.email!;

  // Fetch settings first so we know which teams this user owns as admin
  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  const adminTeamCodes: string[] = ((settingsRow?.data as any)?.teams ?? [])
    .filter((t: any) => t.isAdmin && t.code)
    .map((t: any) => t.code as string);

  const ops: Promise<unknown>[] = [
    // Core user data
    supabase.from('user_settings').delete().eq('user_id', userId),
    supabase.from('user_logs').delete().eq('user_id', userId),
    supabase.from('profiles').delete().eq('email', email),
    // Team participation rows for this user
    supabase.from('team_stats').delete().eq('email', email),
    supabase.from('team_requests').delete().eq('requester_email', email),
  ];

  // If the user was admin of any teams, delete those teams and all their data
  if (adminTeamCodes.length > 0) {
    ops.push(
      supabase.from('teams').delete().in('code', adminTeamCodes),
      supabase.from('team_requests').delete().in('team_code', adminTeamCodes),
      supabase.from('team_stats').delete().in('team_code', adminTeamCodes),
    );
  }

  await Promise.all(ops);

  return res.json({ ok: true });
}
