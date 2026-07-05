// Injected at build time via electron.vite.config.ts `define` (main process only).
// Holds the developer's own embedded Anthropic API key, baked into the
// distributed build so end users get AI Chat working with no setup.
// Empty string when BUILTIN_ANTHROPIC_API_KEY is not set (e.g. local/dev
// builds from source) — code must treat that as "no embedded key available".
declare const __BUILTIN_API_KEY__: string
