import type { SupabaseClient } from '@supabase/supabase-js'

export type Bindings = {
  CSC_API_KEY?: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  AREA: string
  FRONTEND_URL: string
}

export type Variables = {
  supabase: SupabaseClient
  userId: string
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
