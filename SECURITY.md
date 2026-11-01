# Security

Sleeveside runs in your browser and holds the key to your Discogs account. If you find a way
to get at it, or at anything else the app keeps, please tell us privately first.

## How to report

Use GitHub's private reporting:
[report a vulnerability](https://github.com/misterhonk/fidelity/security/advisories/new).
Only the maintainer sees it. Please do not open a public issue for a security problem.

English or German is fine. Useful to have: what you did, what you saw, the version (footer of
the app) and the browser. A proof of concept helps. Please do not try it against somebody
else's account.

The same address is in [`public/.well-known/security.txt`](public/.well-known/security.txt),
served at `/.well-known/security.txt`, so tools find it too.

## What happens then

One person runs this project in their free time. Expect an answer within a week, a fix for
anything that exposes a token or somebody's data as soon as it is understood, and credit in
the advisory if you want it. There is no bug bounty.

## What counts

What the app protects, from whom, and what it does not defend against is in
[`docs/21-THREAT-MODEL.md`](docs/21-THREAT-MODEL.md). These matter most:

- anything that gets the Discogs token, a Dropbox or Google Drive refresh token, or the vault
  passphrase off the device
- script running in the app's origin that is not this build's
- a hub reading what it should only store, or changing what it hands back
- text from Discogs (dealer, listing, release) that turns into markup or a request

Out of scope: Discogs' own rate limits, a self-hosted copy served without the shipped headers,
and anything that needs an already compromised device or browser.

## Supported versions

Only the latest release. The app updates itself through its service worker; no older version
is maintained.
