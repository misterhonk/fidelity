# ADR-014: The code stays open; what is paid for is hosting, data and care

**Status:** Accepted · **Date:** 2026-09-12
**Relates to:** ADR-007, ADR-008, ADR-013 · **Plan:** `docs/17-ROADMAP-1.0.md` §6

## Context

`docs/17` plans a paid comfort tier for 1.0: a hosted hub, the watcher with push, the vault
and share links on Martin's hub, and the reach of the catalogue. The question came up
whether the repository has to be rebuilt for that — the app as a self-hosted product
fetched from GitHub, the hosted service as something else, and the paid features kept out
of the public repository. Or whether the code stays open and the "secret ingredient" is the
aggregated data.

Three facts settle it:

1. **A PWA cannot hide code.** Every byte of JavaScript reaches every browser. A "closed"
   comfort feature in the client would be a public feature with a licence check anyone can
   read in the bundle — the worst of both: closed in spirit, open in practice.
2. **The dump is CC0 and the ETL will be in the repository.** Anybody can build the
   catalogue. What they cannot buy from a repository is somebody doing it every month,
   keeping the hub up, taking backups, answering mail — and the network effect of a shared
   hub, where every expanded horizon, every family and every shipping tier spares the next
   member the request.
3. **The repository is AGPL-3.0.** Whoever offers the software as a network service has to
   hand out the source. For the author that costs nothing; for a competitor it means they
   cannot take hub and catalogue and run them as a closed service. A separate process that
   talks to the hub over HTTP is not a derivative work and may carry any licence.

## Decision

**Open core, no split.** The public monorepo keeps the app, the hub, the catalogue (ETL
and service), `deploy/` and the documentation, under AGPL-3.0 as before. Self-hosters get
images and the prebuilt archive from GitHub Releases, as today, and every feature the
hosted service has — including the catalogue, if they run the monthly build.

**What is paid for is never code.** The comfort tier consists of things that exist only
when somebody runs them: a hosted hub, the watcher, the vault and share links on it, the
catalogue's reach. Their client side — a port, a settings screen, a key in the
preferences — is in the open repository, because it has to be in the bundle anyway.

**One private repository, `fidelity-cloud`, for what has value to nobody else and carries
secrets:** the access service `fidelity-access` with the payment provider's webhooks and
the key issuance, `compose.cloud.yml` with Martin's values, runbooks, the letter to
Discogs. Its interface stays open: the key format and the public-key verification live in
the hub, so a self-hoster could write their own access service. Only the billing glue is
private.

**The name is the one thing self-hosters do not get.** "Fidelity" as the name of the
hosted service is Martin's; the software may be run by anybody, but not offered under that
name as a service. One sentence in the README, the way Ghost does it.

**The test for every future feature:** if it could only exist with closed code, it has
slipped into the wrong layer. Compute on CC0 data, hosting a cache, a process that runs
monthly — those are the layers that may be paid for. A signal, a screen, a sentence are
not.

## Alternatives

**Split the repository into a self-hosted core and a closed "pro" client** — rejected on
fact 1: there is no closed client in a PWA. It would also break the sentence the project
lives by since ADR-007, "no feature requires a hub", by making the difference between
free and paid a matter of code rather than of who runs it.

**Close the catalogue ETL** — rejected: the dump is CC0 and the tools that read it are
open; a closed parser would be a moat of five days' work, and it would cost the
self-hosters the one feature that makes the catalogue worth building.

**Keep the aggregated data as the moat** — half right. The shared hub's contents are a
cache anybody can regenerate from the API and the dump; their value is that they are
already there, for everybody, kept current. That is care and network effect, not secrecy,
and it needs no licence to protect it.

**A different licence (BSL, SSPL, "fair source")** — rejected: it would trade a
theoretical competitor for a real loss of trust in a niche that reads licences, and it
buys nothing AGPL does not already provide against the one scenario that matters.

## Consequences

**Easier:** No rebuild of the repository, no second build pipeline, no code that exists in
two versions. The line between free and paid is the line between a file and a service,
which is easy to explain and impossible to get wrong by accident. The self-hosting story
stays the strongest argument for trusting the hosted one.

**Harder:** The private repository is a second place to keep in step, and the access
service has to be written against an interface so that it *could* be reimplemented — that
discipline costs a little in M22. And the moat is thin by design: somebody who wants to
run a competing hosted Fidelity may, under AGPL, with the source in the open. The bet is
the one `docs/14` §7 made: a niche this size rewards the one person who cares, not the one
who hides.

**What has to be done now:** nothing in code. At M22: create `fidelity-cloud`, move the
provider configuration there before the first webhook exists, and add the trademark
sentence to the README. Before the first euro: the letter.

**The way out:** delete the private repository and the tier. The public repository is the
whole product, as it is today.
