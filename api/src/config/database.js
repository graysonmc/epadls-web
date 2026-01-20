import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

if (!config.supabase.url || !config.supabase.serviceKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
