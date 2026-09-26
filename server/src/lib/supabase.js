import { createClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '../env.js';

let client = null;

/**
 * Cliente com service_role: é o único jeito de ler a tabela
 * oauth_accounts, que fica trancada pro frontend justamente por
 * guardar os tokens das contas reais do Spotify/Deezer/Google.
 */
export function getSupabase() {
  if (!hasSupabase()) {
    throw Object.assign(
      new Error(
        'Supabase não configurado no backend. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
      ),
      { status: 503 }
    );
  }

  if (!client) {
    client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}

export async function getOAuthAccount(provider, profile) {
  const { data, error } = await getSupabase()
    .from('oauth_accounts')
    .select('*')
    .eq('provider', provider)
    .eq('profile', profile)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

export async function saveOAuthAccount(account) {
  const { data, error } = await getSupabase()
    .from('oauth_accounts')
    .upsert(account, { onConflict: 'provider,profile' })
    .select()
    .single();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

export async function deleteOAuthAccount(provider, profile) {
  const { error } = await getSupabase()
    .from('oauth_accounts')
    .delete()
    .eq('provider', provider)
    .eq('profile', profile);

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}
