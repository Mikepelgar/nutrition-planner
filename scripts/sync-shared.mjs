/**
 * Copies the pure shared modules into supabase/functions/_shared so the Edge
 * Function can build prompts with exactly the code the desktop app was built
 * against. Run: node scripts/sync-shared.mjs [--check]
 *
 * Two source trees, one set of rules: Deno resolves relative imports literally
 * and needs the .ts extension, while the app's bundler wants it omitted. Rather
 * than contort src/shared to satisfy both, the copy rewrites the specifiers.
 *
 * --check re-copies into memory and exits non-zero if anything differs from
 * what's on disk, so CI fails on drift instead of shipping a stale prompt.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEST = join(ROOT, 'supabase', 'functions', '_shared')

/** [source path relative to ROOT, destination filename] */
const FILES = [
  ['src/renderer/src/lib/types.ts', 'types.ts'],
  ['src/shared/rdi.ts', 'rdi.ts'],
  ['src/shared/macros.ts', 'macros.ts'],
  ['src/shared/aiContext.ts', 'aiContext.ts'],
  ['src/shared/logProposal.ts', 'logProposal.ts']
]

const HEADER =
  '// GENERATED — do not edit. Source of truth is src/shared/ (and lib/types.ts).\n' +
  '// Regenerate with: node scripts/sync-shared.mjs\n\n'

/** All four land in one flat directory, so every cross-import becomes ./name.ts */
function rewriteImports(source) {
  return source.replace(
    /(from\s+')(\.[^']*?)(')/g,
    (_match, open, spec, close) => `${open}./${spec.split('/').pop()}.ts${close}`
  )
}

const check = process.argv.includes('--check')
mkdirSync(DEST, { recursive: true })

let drifted = 0
for (const [src, name] of FILES) {
  const generated = HEADER + rewriteImports(readFileSync(join(ROOT, src), 'utf8'))
  const destPath = join(DEST, name)

  if (check) {
    // Compare ignoring line endings: with core.autocrlf on Windows, checkouts are
    // CRLF while the generated header is LF, which is not real drift.
    const lf = (s) => s.replace(/\r\n/g, '\n')
    const current = existsSync(destPath) ? readFileSync(destPath, 'utf8') : ''
    if (lf(current) !== lf(generated)) {
      console.error(`drift: ${name} does not match ${src}`)
      drifted++
    }
  } else {
    writeFileSync(destPath, generated)
    console.log(`  ${src} → supabase/functions/_shared/${name}`)
  }
}

if (check) {
  if (drifted) {
    console.error(`\n${drifted} file(s) out of date. Run: node scripts/sync-shared.mjs`)
    process.exit(1)
  }
  console.log('shared modules are in sync')
}
