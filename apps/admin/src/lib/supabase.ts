import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Thiếu VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY (hoặc VITE_SUPABASE_PUBLISHABLE_KEY)',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')
