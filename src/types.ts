import type { SupabaseClient } from '@supabase/supabase-js'

export type Bindings = {
  // Limite de tentativas por IP (src/lib/limite.ts); binding ratelimit do wrangler.toml
  LIMITE?: { limit(opcoes: { key: string }): Promise<{ success: boolean }> }
  // Arquivos da biblioteca de mídia da landing (prefixo landing/ do bucket)
  CERTIFICACOES: R2Bucket
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
