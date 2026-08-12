# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

Für eine App bedeutet SemVer:
**MAJOR** = Breaking Change am IndexedDB-Schema ohne automatische Migration ·
**MINOR** = Features · **PATCH** = Fixes.

## [0.13.0](https://github.com/misterhonk/fidelity/compare/v0.12.0...v0.13.0) (2026-08-12)


### Added

* **collection:** carry the wantlist note, all the way into the shop ([9de2a0b](https://github.com/misterhonk/fidelity/commit/9de2a0be94da952117f946ec1865d0feac7e77c8))
* **collection:** give the wantlist its sleeves, and its language back ([f2f1d7d](https://github.com/misterhonk/fidelity/commit/f2f1d7d2ff2b6c42587b3c231e3c64032ea060c3))
* **collection:** show which shelf a record sits on, and let it move ([908206c](https://github.com/misterhonk/fidelity/commit/908206ceebd01c79c1e84f748f09d1d69ebe136f))
* **sync:** look again the moment somebody comes back to the app ([7799809](https://github.com/misterhonk/fidelity/commit/779980999551e90ce3b6b7a3e862c47308dbb96c))
* **sync:** read the whole collection, so a changed rating can arrive at all ([242e02f](https://github.com/misterhonk/fidelity/commit/242e02f67190961848b5153762d061bee63f379a))
* **ui:** put the shelf's own state on one line and its controls on another ([260ce58](https://github.com/misterhonk/fidelity/commit/260ce58a5aab9049365b645c26e96f3a9e0f2925))
* **ui:** send a change at once, say what became of it, and warn before deleting ([3d2d41a](https://github.com/misterhonk/fidelity/commit/3d2d41a2c17bf2cc02b30ca8e942509e134dc27e))


### Fixed

* **collection:** a record owned twice was quietly one record ([88d1f24](https://github.com/misterhonk/fidelity/commit/88d1f24787a97c1634e5ae875bc0ee0e2f3be6e0))
* **ui:** a comma could not be typed into the blocked-countries field ([42c0f39](https://github.com/misterhonk/fidelity/commit/42c0f39a8535c5063c7fa656573837d0c2172fd8))

## [0.12.0](https://github.com/misterhonk/fidelity/compare/v0.11.0...v0.12.0) (2026-08-12)


### Added

* **collection:** note the condition of your own copy, in Discogs' own words ([70e99fc](https://github.com/misterhonk/fidelity/commit/70e99fc9f1b9b9c29283a03b5bf4756d1b18c413))
* **collection:** put a bought record on the shelf, and take one off it ([f178bdb](https://github.com/misterhonk/fidelity/commit/f178bdb88d76e881fa56481b18061f3da1a51d49))
* **collection:** rate a record you own, and get it to Discogs afterwards ([3914f68](https://github.com/misterhonk/fidelity/commit/3914f688c4432f5283903399639a520f86ed0c9c))
* **collection:** show what the shelf is worth, and write down why any of this writes ([f248b4d](https://github.com/misterhonk/fidelity/commit/f248b4de846645244b89e8cad19d807d23239ead))
* **collection:** want a record without leaving, and stop wanting it ([1481a49](https://github.com/misterhonk/fidelity/commit/1481a498becfba366f0cdebb1e19e23d9c577c7c))
* **discogs:** let the client write, and refuse to repeat what it must not ([b01029a](https://github.com/misterhonk/fidelity/commit/b01029af06c6d83eb3bc996df4758050e9231e1d))
* **ui:** give a record of your own a page, instead of sending it to Discogs ([4ea81fc](https://github.com/misterhonk/fidelity/commit/4ea81fc833958945b280ae05857a6f98bef2adee))
* **ui:** one typeface set, and three families instead of seven ([6c6139b](https://github.com/misterhonk/fidelity/commit/6c6139b083559b6f9c254d6f9ea31b8e5ad479ae))
* **ui:** say what the sheet's buttons do, and give the cover the room it earns ([227a59b](https://github.com/misterhonk/fidelity/commit/227a59b4c7c091d918ab098bce8f5e05d3c88618))


### Fixed

* **ui:** the app set its numbers in two different monospace faces ([626eaa6](https://github.com/misterhonk/fidelity/commit/626eaa66310889269e4aae2a12920f4d308adf92))

## [0.11.0](https://github.com/misterhonk/fidelity/compare/v0.10.0...v0.11.0) (2026-08-11)


### Added

* **deploy:** a dry run that writes nothing, and a base path that is not the root ([e125ae2](https://github.com/misterhonk/fidelity/commit/e125ae2a48a386d9b398b8ae8a466ae0c204ce35))
* **ui:** sort the shelf in both directions ([f691833](https://github.com/misterhonk/fidelity/commit/f6918331740691fc48524f9e1b0454c751dc0cba))


### Fixed

* **deploy:** keep the last three releases, not three arbitrary ones ([1d83d5d](https://github.com/misterhonk/fidelity/commit/1d83d5d45c5fc8fcfe3323b8d1383812d222548c))
* **deploy:** name the environment, or the secrets stay invisible ([fd5f152](https://github.com/misterhonk/fidelity/commit/fd5f1521253a19afd85f2e5dfb9f5474b253a2d7))
* **deploy:** RewriteBase, or Apache puts the filesystem in the address bar ([d07e7fb](https://github.com/misterhonk/fidelity/commit/d07e7fbd8b2324f39ab4cfbed17ef8f0a5019d90))
* **deploy:** say 'delivered but unreachable' instead of just failing ([4dea143](https://github.com/misterhonk/fidelity/commit/4dea1439eac9a89ca4a7b8ca0d66e31c917d99ca))
* **deploy:** take the base path from a variable or a secret ([0c584ce](https://github.com/misterhonk/fidelity/commit/0c584ce837fe171d57230a50960589db2addf801))
* **pwa:** the built page had no title element at all ([498a0e8](https://github.com/misterhonk/fidelity/commit/498a0e801cdc6315eb1ec8fc7c191fe17d307576))
* **pwa:** the install sheet never saw the manifest, so it drew a W ([54f50e3](https://github.com/misterhonk/fidelity/commit/54f50e39c1405adc4d481c199ffc5b402d611aaa))

## [0.10.0](https://github.com/misterhonk/fidelity/compare/v0.9.0...v0.10.0) (2026-08-11)


### Added

* **i18n:** account, collection and search speak English ([5081b71](https://github.com/misterhonk/fidelity/commit/5081b714fef47bfe9f457ea099012eaf10fd8a06))
* **i18n:** all five sections speak English — dig, basket, collection, shops, start ([fda311f](https://github.com/misterhonk/fidelity/commit/fda311fd862bc931d0c3ee8ba503bd6ec02019b2))
* **i18n:** English addresses, and the old ones keep working ([63aec42](https://github.com/misterhonk/fidelity/commit/63aec4264209d8d31c27c4ee23a7f49564b02e3b))
* **i18n:** the app speaks English, and picks German when the device asks ([00c6175](https://github.com/misterhonk/fidelity/commit/00c6175ef5cd4888219c5ce340be4ea848f5cae5))
* **i18n:** the Barry sentence is written where it is read, in both languages ([a5a33ca](https://github.com/misterhonk/fidelity/commit/a5a33cad176fde681bfcb367cf65ba24614e98d1))
* **i18n:** the last screens — onboarding, demo, in-store, privacy, legal ([46ceb8d](https://github.com/misterhonk/fidelity/commit/46ceb8d1a3451f59c95f4e287dfb5c2a472c7e68))
* **i18n:** the pressing warnings, the hub failures, and the last German comment ([109bd0e](https://github.com/misterhonk/fidelity/commit/109bd0ee1223a89ff76f9d166e5605a8ff60e058))
* **i18n:** the rest of the settings, the shared notices and the manual ([186aa37](https://github.com/misterhonk/fidelity/commit/186aa37f3783374d0eba36f02b8aa31cfb30eb59))
* **i18n:** the settings speak English, index and chrome first ([af329af](https://github.com/misterhonk/fidelity/commit/af329af7111526d1fa74be895e121408db3daac6))
* **ui:** make the dark side legible, and give the app a surface ([d025877](https://github.com/misterhonk/fidelity/commit/d025877a0b03869d559f9468f02dcb7babe7760f))


### Fixed

* **deploy:** a release-please tag triggers nothing, so call the workflows ([d497d2f](https://github.com/misterhonk/fidelity/commit/d497d2fd4ccffcaab0e89111f476ad5677589028))
* **i18n:** finish the translation, and stop trusting word lists ([63fee5f](https://github.com/misterhonk/fidelity/commit/63fee5fb623272ee6601c0e3b5e8c212ae4984b2))
* **i18n:** the record's own page was never translated ([f31f2c8](https://github.com/misterhonk/fidelity/commit/f31f2c80780ba8a5aec92ce4fc7d17ac2e2de185))
* **i18n:** translate what only a screen reader could hear ([7f415af](https://github.com/misterhonk/fidelity/commit/7f415afd3b0eae66fcc2cc82552cc28e09c73df6))
* **pwa:** one key in the config silently disabled the service worker plugin ([7d668ca](https://github.com/misterhonk/fidelity/commit/7d668ca77ca0e59aa06386cbe55192a67566f529))
* **ui:** the setup had two roots in one transition, so it would not load in dev ([e819941](https://github.com/misterhonk/fidelity/commit/e819941d884df8333e54c2d31b0343b58d91aea6))


### Changed

* drop two settings nothing ever read, and correct the record ([bace338](https://github.com/misterhonk/fidelity/commit/bace338bd2f230af68159c3dbdaeb1e971fae1e5))
* **i18n:** split the words by area, so a screen's text rides in its own chunk ([c157b75](https://github.com/misterhonk/fidelity/commit/c157b75d59a5cf44ef3f061ca107312c442e7f7e))

## [0.9.0](https://github.com/misterhonk/fidelity/compare/v0.8.0...v0.9.0) (2026-08-11)


### Added

* **deploy:** a release anybody can use without a toolchain ([6e731c3](https://github.com/misterhonk/fidelity/commit/6e731c30cb49837865ed4f0727258b2aa2976e22))
* **deploy:** switch releases with a symlink, so nobody sees half a build ([40a2bd4](https://github.com/misterhonk/fidelity/commit/40a2bd43f17d3a4307df3c1dfc9f96123f1a462a))
* **deploy:** three ways in, one for each kind of person ([b2c6ecb](https://github.com/misterhonk/fidelity/commit/b2c6ecb760cdb24453ecd99830f4cbb50256544d))
* **watch:** the one job that justifies running a hub at all ([bf82b12](https://github.com/misterhonk/fidelity/commit/bf82b12cc150058043ae71c394fff6b2dd5def3e))


### Fixed

* **demo:** the paste field is visible, and above the records ([db42141](https://github.com/misterhonk/fidelity/commit/db4214162997a7f4bec2a383a61274b6ebf05e2f))
* **deploy:** build the site once, not once per architecture ([2552268](https://github.com/misterhonk/fidelity/commit/2552268f7c270c7982cbbe5a84cee8539b3d1e2a))
* **deploy:** the manual image run could never have pushed anything ([918de50](https://github.com/misterhonk/fidelity/commit/918de508f6ef9e828ef4d450d676a95109ecc843))

## [0.8.0](https://github.com/misterhonk/fidelity/compare/v0.7.0...v0.8.0) (2026-08-11)


### Added

* **dig:** take a Discogs link where the field asked for a username ([f9f732b](https://github.com/misterhonk/fidelity/commit/f9f732b05c836c3919241600f81f52fc8a5761a8))
* **hub:** look for one on this machine, and say when the browser forbids it ([afa4ad9](https://github.com/misterhonk/fidelity/commit/afa4ad9085466ddf31f74cd13f9996c49202487f))
* **hub:** share the covers, since the marketplace will not hand them over ([10ae0f7](https://github.com/misterhonk/fidelity/commit/10ae0f73ebb206ad8589cfbe5dca273fb67d8014))
* **sync:** keep the data current instead of hiding the buttons that do it ([b9b5e60](https://github.com/misterhonk/fidelity/commit/b9b5e60eee0754926e7264bdfce3739e39bb4b6c))
* **ui:** the horizon and the credits belong in the setup, in plain words ([970e286](https://github.com/misterhonk/fidelity/commit/970e286d2e4391b8a1ba937223bdd3ce14ebf527))


### Fixed

* **hub:** say what a hub gives you, not what it does not ([eb5df94](https://github.com/misterhonk/fidelity/commit/eb5df94fb2a060dc7210564ab59b402682cf2107))

## [0.7.0](https://github.com/misterhonk/fidelity/compare/v0.6.0...v0.7.0) (2026-08-10)


### Added

* **auth:** show what the app produces before asking for the key ([b32fe59](https://github.com/misterhonk/fidelity/commit/b32fe59ed652803c678440b970745f7edc2fcafc))
* **dealers:** fetch a shop's logo once for shops scanned before it existed ([7c6f3fb](https://github.com/misterhonk/fidelity/commit/7c6f3fbe29c83fd62037d8af5b5897ba344088bc))
* **demo:** a landing page that shows before it asks ([e8f692b](https://github.com/misterhonk/fidelity/commit/e8f692be589f921ca4be8353d1f640b38a4b5511))
* **demo:** Fidelity without a token, from one or two records ([fc26955](https://github.com/misterhonk/fidelity/commit/fc2695595349c904a94d4d3855ee922704d09454))
* **ui:** put the sleeve first, and fetch the ones the marketplace withholds ([623eb7e](https://github.com/misterhonk/fidelity/commit/623eb7e07930be9a68e56579000d36003dbbf77f))
* **ui:** say what a record physically is ([63deffb](https://github.com/misterhonk/fidelity/commit/63deffbbf76535b9e482f0f609ceba6d16eb2e6d))


### Fixed

* **auth:** answer the first question somebody has about a token ([895d065](https://github.com/misterhonk/fidelity/commit/895d065a36bf5fea997b69204c23302ed6ba1555))
* **ui:** the two screens the cover sweep missed ([8c44437](https://github.com/misterhonk/fidelity/commit/8c444373dd8eea0c451206c3710d1d723c8c676d))
* **ui:** white on the accent in light mode, which is what is readable ([964a7bb](https://github.com/misterhonk/fidelity/commit/964a7bb0680b4438d5da475d641515f5e0c6fdc1))


### Changed

* **ui:** one place to write a price, and a country you can set ([260efd1](https://github.com/misterhonk/fidelity/commit/260efd1814a172386a921ebfecece08abd112850))

## [0.6.0](https://github.com/misterhonk/fidelity/compare/v0.5.0...v0.6.0) (2026-08-10)


### Added

* **basket:** make the dealer's minimum order a number you can act on ([8ee2d16](https://github.com/misterhonk/fidelity/commit/8ee2d16622fb632a04c222a9cc70f454fd82bdb8))
* **basket:** say why there is nothing to suggest, and offer the way out ([4c8c765](https://github.com/misterhonk/fidelity/commit/4c8c7655ff73574a98d64359670c23f6aa2019d3))


### Fixed

* **basket:** read the shipping table for the destination country ([7e72e3d](https://github.com/misterhonk/fidelity/commit/7e72e3d7ceea5110a2b8967777330bf855398ab5))
* **dig:** stop an incremental visit from passing judgement on a whole shop ([ae0fd2a](https://github.com/misterhonk/fidelity/commit/ae0fd2a5e65307433004e73d444372baa0590348))
* **discogs:** pace the whole browser, and stop mistaking a 429 for a cable ([7895acf](https://github.com/misterhonk/fidelity/commit/7895acf3460c57c06eaee00500ad36da469145fb))
* **ui:** hang the basket count on the basket, not beside it ([a1d710b](https://github.com/misterhonk/fidelity/commit/a1d710bd9b01ee9c575e1c6c4f921b027843faab))
* **ui:** put the settings gear on the line the other icons stand on ([b4c0571](https://github.com/misterhonk/fidelity/commit/b4c0571846684dffb421e249abcf571ba2c54006))
* **ui:** the twelve things a walk through the app turned up ([291dea0](https://github.com/misterhonk/fidelity/commit/291dea063ca52f8bc69964b378709e1ca3c8637e))

## [0.5.0](https://github.com/misterhonk/fidelity/compare/v0.4.2...v0.5.0) (2026-08-10)


### Added

* **basket:** take the records already picked out on Discogs ([9f453cf](https://github.com/misterhonk/fidelity/commit/9f453cfbe6a2505934838b3935974ffe391bc9af))

## [0.4.2](https://github.com/misterhonk/fidelity/compare/v0.4.1...v0.4.2) (2026-08-10)


### Fixed

* **ui:** stop three rows running off the right edge of a phone ([30b522a](https://github.com/misterhonk/fidelity/commit/30b522a0873529f028f15be5be622c0de4c8d21f))

## [0.4.1](https://github.com/misterhonk/fidelity/compare/v0.4.0...v0.4.1) (2026-08-10)


### Fixed

* **basket:** keep a basket per shop instead of deleting the last one ([dc55fb0](https://github.com/misterhonk/fidelity/commit/dc55fb0c46be1d172dce3b18dcbb49f80dbdec48))

## [0.4.0](https://github.com/misterhonk/fidelity/compare/v0.3.1...v0.4.0) (2026-08-10)


### Added

* **dig:** fetch only what a shop has listed since the last visit ([fd94338](https://github.com/misterhonk/fidelity/commit/fd9433800e93ec97dfea4b002b01ec3bae648a19))

## [0.3.1](https://github.com/misterhonk/fidelity/compare/v0.3.0...v0.3.1) (2026-08-10)


### Fixed

* **ui:** stop the setup saying the same thing twice ([7dbf2c2](https://github.com/misterhonk/fidelity/commit/7dbf2c2e063b4a4a060fbf8654aa10828da2b7e5))

## [0.3.0](https://github.com/misterhonk/fidelity/compare/v0.2.1...v0.3.0) (2026-08-10)


### Added

* **ui:** a setup that runs from the token to the first dig ([6872b24](https://github.com/misterhonk/fidelity/commit/6872b24292dfeeff07fa58f7fe5f39a62db3b7d6))

## [0.2.1](https://github.com/misterhonk/fidelity/compare/v0.2.0...v0.2.1) (2026-08-10)


### Changed

* **ui:** four type sizes, one accent, one grid ([163b0e0](https://github.com/misterhonk/fidelity/commit/163b0e0304fb8f27eeef1beec5b211e29be98059))

## [0.2.0](https://github.com/misterhonk/fidelity/compare/v0.1.0...v0.2.0) (2026-08-10)


### Added

* **auth:** add token entry, identity check and sign-out ([694ea04](https://github.com/misterhonk/fidelity/commit/694ea04fc31275e81b53e3e52601da2b38a29aff))
* **basket:** add the basket, shipping tiers and the optimiser ([5db12ae](https://github.com/misterhonk/fidelity/commit/5db12aeedcbe791cf8a9b1d5e33aa2b6dee9364d))
* **basket:** ask whether the basket is still there ([29d20b2](https://github.com/misterhonk/fidelity/commit/29d20b2988cec333d337dc517acf6f109090da8f))
* **basket:** fill the basket from the shortlist ([b59eef8](https://github.com/misterhonk/fidelity/commit/b59eef8a68d574a6ee72de3a85bb3d1a60361d4e))
* **db:** Dropbox and Drive, with your registration rather than mine ([00cfa81](https://github.com/misterhonk/fidelity/commit/00cfa8160c6f62f78a6adff110fa6a94db42e4a0))
* **db:** the vault — what travels between devices, and what never does ([6b3e9d5](https://github.com/misterhonk/fidelity/commit/6b3e9d5c71d21f29561b566dc79749a4d70afc47))
* **db:** the vault in a file somebody else's client syncs ([d06a8bf](https://github.com/misterhonk/fidelity/commit/d06a8bf58a93967807cd41b053301f8ed88570ad))
* **dealers:** find the shops Discogs already knows you deal with ([1e727c0](https://github.com/misterhonk/fidelity/commit/1e727c01194fc419caf70735c9d3d25ab33190e6))
* **deploy:** app and hub as two Docker services that ignore each other ([874c1a8](https://github.com/misterhonk/fidelity/commit/874c1a8273928cdf8bf605e6325dd704b28cfcdd))
* **dig:** add the credit-graph explorer ([50efe9e](https://github.com/misterhonk/fidelity/commit/50efe9e0b99873f605e065203644334e7c4fe733))
* **dig:** add the style pass and the dealer fingerprint ([94f8533](https://github.com/misterhonk/fidelity/commit/94f8533b3a2680e4fd4ec4cc35534f00bef804aa))
* **dig:** add the Top Five and fold duplicate copies ([d9e5b9c](https://github.com/misterhonk/fidelity/commit/d9e5b9c037b332706c2764b757cc6684f41cddc7))
* **dig:** refresh an expired dig for one request per match ([8e6dc85](https://github.com/misterhonk/fidelity/commit/8e6dc858fed924f8aa39554e84f3a9f1b83ef021))
* **dig:** resume an interrupted scan instead of restarting it ([4a3cfc8](https://github.com/misterhonk/fidelity/commit/4a3cfc86c150b8186a475d9b46ecdb97d5607dba))
* **dig:** scan a dealer and score what comes back ([9871ee0](https://github.com/misterhonk/fidelity/commit/9871ee0e49de91dff35a010540bdce1745c5c8f8))
* **dig:** walk a big shop in thirteen orderings instead of one ([8686481](https://github.com/misterhonk/fidelity/commit/86864817811e0c4134468912cf5b276beb0babff))
* **discogs:** add the paced api client ([3ee88c7](https://github.com/misterhonk/fidelity/commit/3ee88c72dfe173ac6bda18361c7db6fbb1671d90))
* **discogs:** sync collection and wantlist as a delta ([d92c6af](https://github.com/misterhonk/fidelity/commit/d92c6afeb2c92ca10694c1f6170b1125d193850d))
* **horizon:** add staggered revalidation and on-demand master expansion ([0aaf412](https://github.com/misterhonk/fidelity/commit/0aaf412c1fb7582ea53a3243a7ff1db23eb0cd56))
* **horizon:** expand the collection into release-id sets ([8b4b4da](https://github.com/misterhonk/fidelity/commit/8b4b4da510094b0ba5928497dea8f60cd21a790c))
* **horizon:** harvest credits off the favourite records ([5914d6d](https://github.com/misterhonk/fidelity/commit/5914d6d9ef4dd602e56c029b02e4fea4a1897717))
* **hub:** add the optional hub — horizon cache and shipping ladders ([9ecee9f](https://github.com/misterhonk/fidelity/commit/9ecee9f10118496fa3e2ca2a82a837c05e177a8e))
* **hub:** the vault — one block per person, unreadable to the hub ([f51b31e](https://github.com/misterhonk/fidelity/commit/f51b31ef272101ac8e65a84d77a63ddcd129bd3c))
* **match:** add the Barry score and the trigram stage ([5921193](https://github.com/misterhonk/fidelity/commit/5921193cd40da63716ff31826ff7ae96f0b39b1d))
* **match:** add the five signals the horizon unlocks ([defe2d9](https://github.com/misterhonk/fidelity/commit/defe2d9893cd2c6dea2b4b29b1b7a37a7b3c757b))
* **match:** add the pressing advice ([619d664](https://github.com/misterhonk/fidelity/commit/619d6646c8bff89a12a09a2f46662668e2a00789))
* **match:** add the price and scarcity signals ([203a502](https://github.com/misterhonk/fidelity/commit/203a502feea617cf81bf4aabbdcb36c57539293f))
* **match:** compute the taste profile and add Deine Landkarte ([9893b8e](https://github.com/misterhonk/fidelity/commit/9893b8e6d220794861d7d20d136133f1765a4f50))
* **match:** make "prefer originals" do something ([4e77a98](https://github.com/misterhonk/fidelity/commit/4e77a98b5ada41d5413e7cc684495b2c3d4a91cb))
* **pwa:** add the offline mode, the coach mark and the in-store screen ([c264d35](https://github.com/misterhonk/fidelity/commit/c264d35fcb8856dc529f87a6bf5333fab63c7649))
* **pwa:** cache covers, and measure the worker honestly ([307ba9b](https://github.com/misterhonk/fidelity/commit/307ba9b567501a1b4e8d1ae70e7c4e197b85ec76))
* **ui:** add a theme switch and stop iOS zooming on focus ([bae08fa](https://github.com/misterhonk/fidelity/commit/bae08fa4a51eed15d2a6ff4a8854729921188f8e))
* **ui:** add an icon set and lift the nav bar off the edges ([acdd7cf](https://github.com/misterhonk/fidelity/commit/acdd7cfc4732c1037d97f6dd0af0fa976bc35857))
* **ui:** add attribution, legal pages, export and real error messages ([ca8636c](https://github.com/misterhonk/fidelity/commit/ca8636cd04034bdb040f2f4d916f4d924a9f8b31))
* **ui:** add the clerk's take, the dealer profile screen ([6020a82](https://github.com/misterhonk/fidelity/commit/6020a823d4fe709f3c6718e095977822d6e9a80e))
* **ui:** add the feedback buttons that calibrate barry ([361238b](https://github.com/misterhonk/fidelity/commit/361238b608e19d64445754b187c0809a10531956))
* **ui:** add the filter bar, sorting and the density switch ([3b584a1](https://github.com/misterhonk/fidelity/commit/3b584a1c36934dd94f9d01c22feae8c921252da1))
* **ui:** add the next step, the a11y audit and honest Lighthouse numbers ([d49cb80](https://github.com/misterhonk/fidelity/commit/d49cb806fd23be9c93f8a9051287d098db7bb2e4))
* **ui:** add the release detail sheet ([75944d4](https://github.com/misterhonk/fidelity/commit/75944d481324971c966235f1566258e0d55d58f4))
* **ui:** add the virtualised list and the command palette ([44d9ba9](https://github.com/misterhonk/fidelity/commit/44d9ba9bec8b15dd415d16a53b5356e26a5211de))
* **ui:** answer "habe ich die schon?" with the record in your hand ([e0ab5eb](https://github.com/misterhonk/fidelity/commit/e0ab5eb5f312a7692ab49ebda69ed87afad88e09))
* **ui:** give the app a navigation and a settings area ([b867450](https://github.com/misterhonk/fidelity/commit/b8674509417107722b74b491cebeac21af03d0c8))
* **ui:** keep a shortlist that outlives the dig ([010b1e9](https://github.com/misterhonk/fidelity/commit/010b1e9d1c3e5a314334072bbf950e0ba56f4760))
* **ui:** let somebody actually set what a dig looks for ([4e77a98](https://github.com/misterhonk/fidelity/commit/4e77a98b5ada41d5413e7cc684495b2c3d4a91cb))
* **ui:** let the data screens use the screen ([2f90594](https://github.com/misterhonk/fidelity/commit/2f9059448ad0a974976f295e8c571fb2e0bfe53a))
* **ui:** let the shortlist change its mind ([0be76ba](https://github.com/misterhonk/fidelity/commit/0be76ba3ba246f1355da7babc84b6e7f6b6934eb))
* **ui:** make the dashboard numbers lead somewhere ([099af2b](https://github.com/misterhonk/fidelity/commit/099af2bc46f9a56fed4c4b4c33021aa09530f4d3))
* **ui:** make the start screen the collection rather than a report ([a61e4b3](https://github.com/misterhonk/fidelity/commit/a61e4b3056fcfa079e7c1780dd5248a2e0bf9195))
* **ui:** Presswerk as the default, and the switch stays ([7ce8940](https://github.com/misterhonk/fidelity/commit/7ce89403c683ab880e0c60e0cbfd8259ed81bf9a))
* **ui:** set the vault up once, then stop thinking about it ([1ca0ac8](https://github.com/misterhonk/fidelity/commit/1ca0ac8dad07c959dd84899b481688a62f40a41f))
* **ui:** show the wantlist ([996a6a5](https://github.com/misterhonk/fidelity/commit/996a6a54d9c2739f155d7bdf5b3f3bb9c37d3acc))
* **ui:** tell the map how much of a label and an artist you actually have ([268b504](https://github.com/misterhonk/fidelity/commit/268b5044e72869998a97cf3b569421c30607b81b))
* **ui:** the match list goes multi-column, and shops are one click ([b4e3cb3](https://github.com/misterhonk/fidelity/commit/b4e3cb3591460df4eecbbf0d9bd779697b13457e))
* **ui:** three type sets, switchable in front of real data ([18cd035](https://github.com/misterhonk/fidelity/commit/18cd035f298cf8eea67084b2bb064a33b86f1e8c))
* **ui:** your records, as a shelf ([a8cb54f](https://github.com/misterhonk/fidelity/commit/a8cb54f563c9e660fa527f9fbbbaacc32a3c0718))
* **watch:** add the watchlist and its cheap change detector ([7b32064](https://github.com/misterhonk/fidelity/commit/7b320646e561d5519f816979ca2ce25986fe01de))


### Fixed

* **basket:** stop silently discarding a shipping table ([5db12ae](https://github.com/misterhonk/fidelity/commit/5db12aeedcbe791cf8a9b1d5e33aa2b6dee9364d))
* **build:** stop the size budget measuring the wrong file ([d49cb80](https://github.com/misterhonk/fidelity/commit/d49cb806fd23be9c93f8a9051287d098db7bb2e4))
* **deploy:** the shell went out with no cache directive at all ([d6f2270](https://github.com/misterhonk/fidelity/commit/d6f22701118261f45a5ceb4588320922c7c8f722))
* **dig:** stop offering a running scan as resumable ([3326723](https://github.com/misterhonk/fidelity/commit/33267239c0450a53552d28d66695052e4dbb5f19))
* **match:** correct the artist cascade and drop an invented weighting ([9c31270](https://github.com/misterhonk/fidelity/commit/9c3127036e062315b96687abc9a9028f0e2de393))
* **match:** stop offering a CD as an upgrade for a CD ([5abef63](https://github.com/misterhonk/fidelity/commit/5abef63df8f91bf7ed45655b0b5eb0b05023b327))
* tag releases as v0.1.0, not fidelity-v0.1.0 ([7d36b1b](https://github.com/misterhonk/fidelity/commit/7d36b1b7349ac5d2e4be8416efc907724f75ffcc))
* **ui:** give every text-link action its 24 pixels ([a713817](https://github.com/misterhonk/fidelity/commit/a713817c9186bb332a31251b8b6609cf6d142526))
* **ui:** give the nav bar the room the home indicator takes ([6892e06](https://github.com/misterhonk/fidelity/commit/6892e0609ab28c7f94768d0bc2bb5713c8c6d355))
* **ui:** make the digs that are kept actually reachable ([4e66aa6](https://github.com/misterhonk/fidelity/commit/4e66aa63ebc010ebfe7750a02eded338756db273))
* **ui:** raise the light-mode accent to step 700 for AA contrast ([fe5dc9d](https://github.com/misterhonk/fidelity/commit/fe5dc9d3d0b28477967cf62f78f665f2e6f06c24))
* **ui:** roll back an optimistic click that did not survive ([86f54e3](https://github.com/misterhonk/fidelity/commit/86f54e3b80b80674ecfeed2bea168e92bdf36c52))
* **ui:** show the navigation on pages that do not ask who is signed in ([c06d716](https://github.com/misterhonk/fidelity/commit/c06d7167b2ba3bec8296eb044c79afd3d6872f4c))
* **ui:** stop hiding dealers that were never scanned ([7b32064](https://github.com/misterhonk/fidelity/commit/7b320646e561d5519f816979ca2ce25986fe01de))
* **ui:** stop reporting real storage as "0 MB" ([b867450](https://github.com/misterhonk/fidelity/commit/b8674509417107722b74b491cebeac21af03d0c8))
* **ui:** stop the footer hiding behind the mobile tab bar ([b867450](https://github.com/misterhonk/fidelity/commit/b8674509417107722b74b491cebeac21af03d0c8))
* **ui:** stop the segmented controls stretching across a monitor ([3a7a144](https://github.com/misterhonk/fidelity/commit/3a7a14456ab0b490f1f354297ab72b3781ffda10))
* **ui:** write the numbers out where they are read as words ([c46a525](https://github.com/misterhonk/fidelity/commit/c46a5258ad30e5137b38175621ef517fce124477))
* **watch:** scanning a shop no longer stops watching it ([0dc657f](https://github.com/misterhonk/fidelity/commit/0dc657ff5ed84d5dea298df6ec098898b88414a3))
* **watch:** stop the first check reporting a whole shop as new ([7b32064](https://github.com/misterhonk/fidelity/commit/7b320646e561d5519f816979ca2ce25986fe01de))
* **worker:** stop throwing away the reason a request failed ([ca8636c](https://github.com/misterhonk/fidelity/commit/ca8636cd04034bdb040f2f4d916f4d924a9f8b31))


### Changed

* **ui:** extract CatalogRunGrid from the detail sheet ([50efe9e](https://github.com/misterhonk/fidelity/commit/50efe9e0b99873f605e065203644334e7c4fe733))
* **ui:** make settings an index with pages behind it ([7863683](https://github.com/misterhonk/fidelity/commit/7863683c4bd5e9bc9f6541191486e5b09fe623c5))
* **ui:** put the reasoning one click behind the number ([db903b5](https://github.com/misterhonk/fidelity/commit/db903b5df0f6fd7f9d85e528154574d6161dae43))
* **ui:** say the same word in the tab and on the page ([92650dd](https://github.com/misterhonk/fidelity/commit/92650dddbafb1ae90756677b1da03fc46c1a3b8e))
* **ui:** stop shipping a component library this app never renders ([c06d716](https://github.com/misterhonk/fidelity/commit/c06d7167b2ba3bec8296eb044c79afd3d6872f4c))
* **worker:** defer the enrichment pass ([619d664](https://github.com/misterhonk/fidelity/commit/619d6646c8bff89a12a09a2f46662668e2a00789))
* **worker:** defer the horizon build, and stop the budget lying ([307ba9b](https://github.com/misterhonk/fidelity/commit/307ba9b567501a1b4e8d1ae70e7c4e197b85ec76))
* **worker:** split the basket and detail sheet out of the worker ([5db12ae](https://github.com/misterhonk/fidelity/commit/5db12aeedcbe791cf8a9b1d5e33aa2b6dee9364d))

## [Unreleased]

## [0.1.0] - 2026-08-09

**M0 · Fundament.** Eine leere, aber vollständig verdrahtete PWA: `pnpm dev`
startet sie, `pnpm build` erzeugt statische Dateien, und alle Prüfungen laufen
durch. Ein Dig ist noch nicht drin – der kommt mit M2.

### Added

- **Nuxt 4.5 als statisch generierte SPA** (`ssr: false`), Vue 3.5, TypeScript
  im `strict`-Modus. Kein Node zur Laufzeit, das Deployment ist ein Docroot.
- **IndexedDB-Datenmodell** über `idb` (~2 KB): neun Stores samt Indizes,
  Präferenzen mit Default-Merge, und der Verfallsjob, der die 6-Stunden-Regel
  der Discogs-ToS durchsetzt – Marktplatzfelder werden genullt, Score, Signale
  und Begründung bleiben.
- **Web Worker mit typisiertem `postMessage`-Protokoll.** Request/Response mit
  offenem Fortschrittskanal und Abbruch über `AbortSignal`. Der Main-Thread
  rendert, sonst nichts.
- **Design Tokens im DTCG-Format** (`tokens/*.json`) → Style Dictionary →
  Tailwind-4-`@theme`. OKLCH durchgehend, Farbschema-Rollen als eine einzige
  `light-dark()`-Deklaration, fluide Typo-Skala mit erzwungenem `rem`-Term
  (WCAG 1.4.4). Dazu Nuxt UI 4.
- **PWA**: Manifest, Maskable-Icons aus den Tokens gerendert, und
  `registerType: 'prompt'` samt Update-Banner – ein stilles `skipWaiting`
  würde den Code mitten in einem laufenden Dig austauschen.
- **Die drei Hub-Ports** (`HorizonSource`, `ShippingProfileSource`,
  `WatchService`) mit lokalen Implementierungen und der Fallback-Kette:
  2 s Timeout, kein Retry, lautloser Rückfall. Ein kaputter oder gar nicht
  vorhandener Hub ist ununterscheidbar (ADR-008).
- **Toolchain**: ESLint 10 mit `@nuxt/eslint`, Prettier, lefthook,
  commitlint, Vitest 4 mit `fake-indexeddb`, Playwright inklusive WebKit und
  `@axe-core/playwright`.
- **CI** mit Bundle-Budget: 120 KB gzip für den ersten sinnvollen Paint,
  Überschreitung bricht den Build. Alle Actions auf Commit-SHA gepinnt.
- **release-please** mit Keep-a-Changelog-Mapping.
- Projektkonzept und vollständige Architekturdokumentation unter `docs/`,
  ADR-001 bis ADR-008, HTML-Onepager und UI-Wireframes (9 Screens).

### Changed

Entscheidungen, die während M0 revidiert wurden – vor dem ersten Release, also
ohne Migrationspfad:

- **Architektur auf reine Client-PWA umgestellt (ADR-007).** Kein Backend,
  keine Datenbank, kein Serverprozess. Grundlage: Discogs erlaubt CORS aus dem
  Browser (`allow-origin: *`, `authorization` erlaubt), am 2026-08-09
  verifiziert. Der eigentliche Gewinn ist das Rate-Limit – es gilt pro IP, im
  Browser also pro Nutzer statt einmal für alle.
- Speicher von PostgreSQL auf IndexedDB umgestellt.
- Auth von OAuth 1.0a auf Personal Access Token
  (`POST /oauth/access_token` ist per CORS gesperrt).
- Katalogdaten: Volldump (10,4 GB) durch bedarfsgesteuerten Horizont ersetzt
  (ADR-005).
- Deployment auf statisches Hosting reduziert.

### Known Issues

- Der erste sinnvolle Paint liegt bei 114 von 120 KB gzip – und das mit einer
  leeren App. Nuxt UI und sein CSS machen den Löwenanteil aus.
- `--fid-accent` erreicht im Light Mode nur 3,09:1 gegen `--fid-bg` und
  verfehlt damit WCAG 2.2 AA für Fließtext. Betroffene Stellen weichen
  vorerst auf `--fid-text` aus.

[Unreleased]: https://github.com/misterhonk/fidelity/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/misterhonk/fidelity/releases/tag/v0.1.0
