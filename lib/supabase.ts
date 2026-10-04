import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kgnvucgjihvtbedpxjwn.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbnZ1Y2dqaWh2dGJlZHB4anduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTgxODcsImV4cCI6MjEwNjIzNDE4N30.cVziE7XfEChqgylNlJJCJEl_-OoltxM1-E-6sTRXiWs';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const getClient = () => {
  return supabase;
};
