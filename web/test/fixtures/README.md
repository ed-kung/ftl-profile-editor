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

## Saved games — any other `*.sav`

Real saves, each rewritten and compared byte for byte against the extracted game data. Name them
however you like; anything ending in `.sav` that isn't a profile is picked up. A real save is the
only way to catch a misread format, because hand-built ones only prove the code agrees with itself.

    cp ~/Library/Application\ Support/FasterThanLight/continue.sav test/fixtures/calm.sav

`continue.sav` lives beside the profile and exists only during a run. FTL writes it on "Save and
Quit". The more of the format a save reaches, the better, so aim for:

* mid-combat, with weapons charged and projectiles in the air
* at the rebel flagship, which has artillery in several rooms
* with hacking and mind control installed, ideally in use
* in a hazard: asteroids, a sun, a pulsar or PDS
* with drones of several kinds deployed
* from each FTL version you can get hold of

## The integration test

`integration.test.ts` reads the real `ftl.dat` directly rather than these fixtures. It looks in the
macOS location by default; point `FTL_DAT` at yours if it lives elsewhere:

    FTL_DAT=/path/to/ftl.dat npm run test
