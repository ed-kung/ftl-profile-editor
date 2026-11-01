FTL Profile Editor — browser edition
====================================

A browser port of the profile half of this repository's Java editor. Open the page, point it at
your FTL install once, drop in `ae_prof.sav`, edit, and download the result. Everything runs in
the browser: no server, no upload, no install.

Live at <https://ed-kung.github.io/ftl-profile-editor/>.

The Java application under `../src` is untouched and remains the reference for the file formats.


What it edits
-------------
* Ship unlocks — Type-A and Type-C per ship, with Type-B shown as the game derives it.
* Ship achievements — the three per ship that unlock Type-B, by difficulty.
* General achievements — all of them, by difficulty, plus the hangar's newbie tip level.
* General stats — the five top scores, session records, crew records and lifetime totals.
* Ship stats — per-ship best runs, and quest and victory achievements per Type-ABC layout.

Saved games (`continue.sav`) are **not** supported here. Use the desktop application for those.


Why it needs ftl.dat
--------------------
A profile stores achievement ids, not achievement definitions, and the layout of its bytes depends
on which ids are *ship victory* achievements — those records carry three extra fields. Only the
game's own data files say which is which, so the editor cannot read a profile correctly without
them.

Picking `ftl.dat` reads its index (about 180 KB of a 278 MB file) and extracts roughly a megabyte
of XML plus the icons, downscaled. That subset is cached in the browser, so it is a one-time step.
The archive is never uploaded and never copied.


Developing
----------
    npm install
    npm run dev          # http://localhost:5173/ftl-profile-editor/
    npm run test
    npm run build

Some tests need a real install and a real profile; see `test/fixtures/README.md`. They skip
themselves when those are absent, which is how CI runs them.

    npm run extract-fixtures     # pulls test data out of your own ftl.dat


How it maps to the Java source
------------------------------
| Browser | Java |
| --- | --- |
| `src/lib/io/` | `net.blerf.ftl.parser.Parser` |
| `src/lib/profile/ProfileParser.ts` | `net.blerf.ftl.parser.ProfileParser` |
| `src/lib/dat/PkgPack.ts`, `FTLPack.ts` | `net.vhati.ftldat.*` (read paths only) |
| `src/lib/data/` | `net.blerf.ftl.parser.DefaultDataManager` (profile-relevant parts) |
| `src/ui/tabs/` | `net.blerf.ftl.ui.Profile*Panel` |

Two behaviours in `DefaultDataManager` are quirks rather than intent, and are reproduced
deliberately because the byte layout depends on them — see the comments in
`src/lib/data/achievements.ts`.


Safety
------
Quit FTL before editing, as with the desktop editor.

On open, the editor re-serialises the profile it just parsed and compares it to the bytes you gave
it. If they differ, saving is disabled and the first differing offset is reported: that mismatch
would mean the format is being misread, and a file written from it could be one FTL refuses to
load. "Download backup" hands you the untouched original at any time.
