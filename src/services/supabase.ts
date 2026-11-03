import { createClient } from '@supabase/supabase-js';

import { firebaseAuth } from '@/services/firebase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
}

if (!supabasePublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    accessToken: async () => {
      const user = firebaseAuth.currentUser;
      return user ? user.getIdToken() : null;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
