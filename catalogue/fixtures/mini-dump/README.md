# The mini-dump

The first 400 releases of the Discogs dump of 2026-09-01 (`discogs_20260901_releases.xml.gz`,
SHA-256 `7dd4b9b6…279ac0`), and exactly the masters, labels and artists they refer to, cut
from the real files with `scripts/cut-mini-dump.ts` and written back in the dump's own shape.
Four gzip files, about 660 kB together.

| File | Entities | Why this many |
|---|---|---|
| releases | 400 | the first 400 ids — early Svek, Planet E, Ruffhouse, Warp |
| masters | 336 | every `master_id` the releases name |
| labels | 180 | every label on a release |
| artists | 731 | every credited artist, main and extra |

Cut from a real dump rather than typed by hand, so the parser meets the dump's actual habits:
a catalogue number written twice with and without a space, `<master_id>0</master_id>` for
"none", `&#13;` in a profile, a credit string of three roles with a qualifier in brackets, a
run-out with a struck-through word in it. The families are small — the cut is consecutive
ids, so a master has at most two of its pressings here — which is enough to test the shape
and nothing to measure against.

The data is CC0, as the dump is. To cut it again from another month:

```
node scripts/cut-mini-dump.ts <dump dir> fixtures/mini-dump 400 <yyyymmdd>
```

where the dump dir holds the three small files gzipped and the releases file as a plain,
truncated `.xml` — the first few megabytes of the 10 GB file are enough, and the reader stops
at the 400th complete `<release>`.
