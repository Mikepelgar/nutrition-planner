// Injected at build time via electron.vite.config.ts `define` (main process only).
//
// Neither value is a secret. The anon key is a publishable identifier whose
// reach is bounded entirely by the RLS policies in supabase/migrations — it is
// meant to ship inside clients. The provider API key it replaced was not, which
// is why it now lives in Supabase secrets and never in this bundle.
//
// Empty strings when SUPABASE_URL / SUPABASE_ANON_KEY are unset (a build from
// source with no .env) — code must treat that as "AI unavailable in this build".
declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string
