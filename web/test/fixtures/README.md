# Test fixtures

These files are gitignored: one set is Subset Games' game data, the other is a personal save.
Tests that need them skip themselves with a message when they are absent, so CI stays green.

## Game data — `data/` and `img/`

Extracted straight out of your own install, through the same `PkgPack` the browser uses:

    npm run extract-fixtures -- "/Applications/FTL Advanced Edition.app/Contents/Resources/ftl.dat"

The path argument is optional; it defaults to the macOS location above. Typical output is 14 XML
files (~1 MB) and 92 icons (~2.8 MB).

## Profile — `ae_prof.sav`

A real FTL 1.5.4+ profile, which the round-trip test rewrites and compares byte for byte:

    cp ~/Library/Application\ Support/FasterThanLight/ae_prof.sav test/fixtures/

Other platforms keep it in `%USERPROFILE%\Documents\My Games\FasterThanLight\` (Windows) or
`~/.local/share/FasterThanLight/` (Linux).

## The integration test

`integration.test.ts` reads the real `ftl.dat` directly rather than these fixtures. It looks in the
macOS location by default; point `FTL_DAT` at yours if it lives elsewhere:

    FTL_DAT=/path/to/ftl.dat npm run test
