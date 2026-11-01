# Third-party notices

Sleeveside itself is licensed under the GNU AGPL v3 (see `LICENSE` in the
repository, and `LICENSE-EXCEPTION.md` for the additional permission). This
file lists the third-party material that ships inside the built app, and the
licence each one comes under.

This file, `OFL.txt` and `APACHE-2.0.txt` live in `public/`, so every build carries them: the
website, the release archive and the container images.

## Fonts

| Font            | Files                     | Licence                                                                                                                                                                                                |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JetBrains Mono  | `JetBrains-Mono-*.woff2`  | SIL Open Font License 1.1, full text in `OFL.txt`. Copyright 2020 The JetBrains Mono Project Authors                                                                                                   |
| Switzer         | `Switzer-*.woff2`         | ITF Free Font License (Fontshare), © Indian Type Foundry. Licensed for use in this app; the files may not be redistributed through repositories or public servers. See `docs/05-DESIGN-SYSTEM.md` §2.5 |
| Cabinet Grotesk | `Cabinet-Grotesk-*.woff2` | ITF Free Font License (Fontshare), © Indian Type Foundry. Same terms as Switzer                                                                                                                        |

## Icons

**Lucide** (https://lucide.dev), the subset generated into
`app/utils/lucide.generated.ts` by `scripts/icons/lucide.mjs`. ISC License.

> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
> part of Feather (MIT). All other copyright (c) for Lucide are held by
> Lucide Contributors 2022.

The ISC text below applies, and for the Feather portions the MIT text below,
with "Copyright (c) 2013-2022 Cole Bemis".

## JavaScript and CSS

Bundled into the app, all under the MIT License unless noted:

| Package                         | Copyright                                           |
| ------------------------------- | --------------------------------------------------- |
| Nuxt                            | Copyright (c) 2016-present - Nuxt Team              |
| Nuxt UI                         | Copyright (c) 2023 Nuxt                             |
| Vue                             | Copyright (c) 2018-present, Yuxi (Evan) You         |
| Reka UI (via Nuxt UI)           | Copyright (c) 2023 UnoVue                           |
| VueUse (via Nuxt UI)            | Copyright (c) 2019-PRESENT Anthony Fu               |
| tailwind-merge (via Nuxt UI)    | Copyright (c) 2021 Dany Castillo                    |
| tailwind-variants (via Nuxt UI) | Copyright (c) 2020 Tailwind Variants                |
| Tailwind CSS (generated CSS)    | Copyright (c) Tailwind Labs, Inc.                   |
| TanStack Virtual                | Copyright (c) 2021-present Tanner Linsley           |
| Zod                             | Copyright (c) 2025 Colin McDonnell                  |
| Workbox (service worker)        | Copyright 2018 Google LLC                           |
| zxing-wasm (barcode reader, JS) | Copyright (c) 2023 Ze-Zheng Wu                      |
| idb                             | Copyright (c) 2016, Jake Archibald. **ISC License** |

Smaller transitive packages carry their own licence files; `pnpm licenses
list --prod` prints the complete list for a given lockfile.

## WebAssembly

`zxing_reader.*.wasm`, the barcode reader Safari loads on the first scan
(ADR-018), is zxing-wasm's reader build. It is compiled from:

| Component                                 | Copyright                                                                                         | Licence                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ZXing C++ (zxing-cpp), commit `2ecec3f`   | Copyright 2016 ZXing authors, Copyright 2016 Nu-book Inc., Copyright 2017-2026 Axel Waggershauser | Apache License 2.0, full text in `APACHE-2.0.txt`                       |
| `ZXingWasm.cpp`, zxing-wasm's C++ binding | Copyright 2016 Nu-book Inc., Copyright 2023 Axel Waggershauser, Copyright 2023 Ze-Zheng Wu        | Apache License 2.0, full text in `APACHE-2.0.txt`                       |
| libzueci, vendored in zxing-cpp           | Copyright (C) 2022 gitlost, adapted from libzint                                                  | BSD 3-Clause, text below                                                |
| stb_image, linked by `ZXingWasm.cpp`      | Copyright (c) 2017 Sean Barrett                                                                   | MIT (alternative A of its MIT / public-domain dual licence), text below |

Source: https://github.com/zxing-cpp/zxing-cpp and
https://github.com/Sec-ant/zxing-wasm (v3.1.5). zxing-cpp carries no `NOTICE`
file. The writer half of zxing-wasm, and the zint library it uses, is not
shipped.

---

### MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### BSD 3-Clause License (libzueci)

Copyright (C) 2022 gitlost

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

### ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
