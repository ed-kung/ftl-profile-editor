FTL Profile Editor — browser edition
====================================

A browser port of this repository's Java editor. Open the page, point it at your FTL install once,
drop in `ae_prof.sav` or `continue.sav`, edit, and download the result. Everything runs in the
browser: no server, no upload, no install.

Live at <https://ed-kung.github.io/ftl-profile-editor/>.

The Java application under `../src` is untouched and remains the reference for the file formats.


What it edits
-------------
Profiles (`ae_prof.sav`, `prof.sav`):

* Ship unlocks — Type-A and Type-C per ship, with Type-B shown as the game derives it.
* Ship achievements — the three per ship that unlock Type-B, by difficulty.
* General achievements — all of them, by difficulty, plus the hangar's newbie tip level.
* General stats — the five top scores, session records, crew records and lifetime totals.
* Ship stats — per-ship best runs, and quest and victory achievements per Type-ABC layout.

Saved games (`continue.sav`), from FTL 1.5.4 on:

* General — difficulty, session totals, cargo, rebel pursuit, environment, nearby ship AI, encounter.
* Ship — either ship's name, supplies and systems, plus its crew, weapons, drones and augments.
* Sector Tree — the route, and the seed behind it.
* State Vars — the counters that events check.

Saves from FTL 1.03.3 and earlier open read-only, because the Java writer doesn't support that
format either.

The desktop application still has more for saved games: the drawn ship floorplan with its per-room
detail, the sector map, stores, and changing ship.


Why it needs ftl.dat
--------------------
A profile stores achievement ids, not achievement definitions, and the layout of its bytes depends
on which ids are *ship victory* achievements — those records carry three extra fields. A saved
game is the same, only more so: it has no count of a ship's rooms or doors, nor any mark of what
shape a drone's record takes. Only the game's own data files say, so the editor cannot read either
file correctly without them.

Picking `ftl.dat` reads its index (about 180 KB of a 278 MB file) and extracts the XML and ship
layouts it needs plus the icons, downscaled. That subset is cached in the browser, so it is a
one-time step, repeated only when an update needs more from the file. The archive is never
uploaded and never copied.


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
| `src/lib/save/` | `net.blerf.ftl.parser.SavedGameParser` |
| `src/lib/save/rng.ts`, `sectorTree.ts` | `net.blerf.ftl.parser.random`, `.sectortree`, `model.sectortree` |
| `src/lib/data/` | `net.blerf.ftl.parser.DefaultDataManager` (the parts in use) |
| `src/ui/tabs/` | `net.blerf.ftl.ui.Profile*Panel` |
| `src/ui/save/` | `net.blerf.ftl.ui.SavedGame*Panel` |

The saved-game code differs from the Java in structure on purpose. `src/lib/save/types.ts` declares
each run of fields once, in file order, and `struct.ts` uses that one table to read, write and type
it, where the Java spells out each record twice. Writing needs no game data, because the state
keeps what reading took from it. Store shelves keep empty slots: Java's list closes them up, which
would move an item if an earlier slot were empty.

Two behaviours in `DefaultDataManager` are quirks rather than intent, and are reproduced
deliberately because the byte layout depends on them — see the comments in
`src/lib/data/achievements.ts`.


Safety
------
Quit FTL before editing, as with the desktop editor.

On open, the editor re-serialises the file it just parsed and compares it to the bytes you gave it.
If they differ, saving is disabled and the first differing offset is reported: that mismatch would
mean the format is being misread, and a file written from it could be one FTL refuses to load.
"Download backup" hands you the untouched original at any time.

Saved games get a second check, because edits there can change the file's structure: adding a
drone adds a pod record later on, and installing a system adds its own. `src/lib/save/mutations.ts`
keeps those records in step, and every saved file is read back before it is offered for download.

These checks prove a file is well formed, not that the game likes it. Only FTL can say that.
