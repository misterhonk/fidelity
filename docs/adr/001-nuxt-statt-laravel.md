# ADR-001: Nuxt/Node statt Laravel/PHP

**Status:** Akzeptiert, teilweise ersetzt durch **ADR-007** · **Datum:** 2026-08-09

> Die Wahl von Nuxt/Vue bleibt gueltig. Die Begruendung ueber Nitro als Server-Runtime
> ist ueberholt: Fidelity hat kein Backend mehr, Nuxt laeuft im SPA-Modus (`ssr: false`)
> und wird statisch generiert. Siehe ADR-007.

## Kontext

Martin arbeitet beruflich hauptsächlich mit PHP (Shopware), JavaScript, Vue, SCSS. Der
Stack war explizit freigestellt. Die Arbeitslast ist ungewöhnlich: tausende paginierte,
rate-limitierte externe API-Aufrufe in Hintergrundjobs, plus eine datendichte, interaktive UI.

## Entscheidung

**Nuxt 4.5 auf Node 22.** Eine Sprache für Front- und Backend.

## Alternativen

**Laravel 13 + Inertia/Vue** – ernsthaft erwogen und in einem Punkt objektiv überlegen:
Laravels Queue-Story ist die beste in jedem Web-Framework. `Bus::batch()` mit Fortschritt
und `catch()`, `RateLimited`- und `WithoutOverlapping`-Middleware (exakt für „60 Requests
pro Minute gegen eine externe API" gebaut), Horizon für Queue-Observability, Octane.
Verworfen, weil zwei Sprachen im Projekt einen dauerhaften Kontextwechsel bedeuten und
Vue-Kenntnis auf beiden Seiten mehr wiegt als eine bessere Queue-Bibliothek.

**Next.js 16** – exzellent, aber React + Vercel-Gravitation. Kein Grund, umzulernen.
**SvelteKit** – schlank und schön, aber Ökosystem-Tausch ohne Gegenwert.
**Astro** – falsche Form; das hier ist eine App, keine Dokumentseite.

## Konsequenzen

**Leichter:** Ein `pnpm install`, ein Typsystem, geteilte Zod-Schemas zwischen Client und
Server, ein Deploy-Artefakt. Nitros `.output` ist self-contained – auf Uberspace ein
riesiger Vorteil.

**Schwerer:** Wir bauen Job-Infrastruktur selbst nach, die Laravel mitbringt.
**Gegenmaßnahme:** Laravels *Design* stehlen – Rate-Limiter-Middleware, Batch mit
Fortschritt, Overlap-Lock – nur auf pg-boss statt Horizon.

**Ausstiegspfad:** Die Scoring-Engine ist eine reine Funktion und in jeder Sprache
portierbar. Der teure Teil wäre der Discogs-Client, nicht die Fachlogik.
