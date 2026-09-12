# fidelity-catalogue

The catalogue: Discogs' monthly CC0 dump, read once, answering what the API answers slowly
or not at all — every pressing of an album at once, every record a producer touched, a
barcode without a request. Optional like the hub, and one rule stricter: nothing of a person
is ever here, only the records. Decision in [ADR-013](../docs/adr/013-catalogue-service.md),
design in [docs/16](../docs/16-CATALOGUE-SERVICE.md).

## What is here

```
src/etl/xml.ts          streams a dump file one entity at a time, whatever its size
src/etl/shape.ts        one entity → the rows of docs/16 §4 (pure)
src/etl/catno.ts        parseCatno, the app's copy — held to it by tests/unit/catalogue-twins.spec.ts
src/etl/names.ts        norm, the app's copy — same test
src/etl/roles.ts        ROLE_TABLE, the app's copy, and the dump's credit strings mapped onto it
src/etl/identifiers.ts  barcode and run-out, in the form two people type the same
src/etl/db.ts           the schema, the indexes, the derived label prefixes
src/etl/build.ts        the build: four files in, one SQLite file out, row counts checked
scripts/cut-mini-dump.ts  cuts fixtures/mini-dump from a real dump
fixtures/mini-dump/     400 real releases and what they point at, ~660 kB (see its README)
test/                   node --test; golden files under test/golden/
```

## Running it

```
npm ci
npm test                                   # the ETL on the mini-dump, under a second
node src/etl/build.ts --dump <dir> --date 20260901 --out catalogue.sqlite [--previous last.sqlite]
```

The dump dir holds the four files under their published names,
`discogs_<date>_{artists,labels,masters,releases}.xml.gz`; a plain `.xml` is read too. With
`--previous`, the row counts are checked against last month's file and the build refuses to
finish on a table that moved more than ten percent.

The service that answers over HTTP is M21.4; the container that runs the build monthly on
the home lab is M21.3.

## Regenerating the golden files

`UPDATE_GOLDEN=1 npm test` rewrites `test/golden/*.json` from the current build. Read the
diff before committing it: every line in it is a catalogue number, an identifier or a name
that now parses differently, and the commit message should say why.
