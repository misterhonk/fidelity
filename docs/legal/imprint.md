# Legal notice template — draft

> **Draft. Not legal advice. Review by a lawyer before going live.**
> Replaces the GitHub-only notice in `app/pages/legal.vue` the day the first tier is sold:
> from then on the service is "geschäftsmäßig" and § 5 DDG wants a postal address
> (`docs/09-LEGAL.md` §3.1). Until then the current page stays.
> **The German text is the legally relevant version**; the English one is a convenience
> translation. Placeholders are listed in [README.md](README.md). Real values never go into
> this repository.

---

## Deutsch

### Impressum

Angaben gemäß § 5 DDG

{{NAME}}
{{STREET}}
{{POSTCODE_CITY}}
Deutschland

**Kontakt**
E-Mail: {{EMAIL}}
{{PHONE_OR_CONTACT}}

**Umsatzsteuer-Identifikationsnummer** gemäß § 27a UStG: {{VAT_ID_IF_ANY}}
*(Zeile weglassen, wenn es keine gibt. Eine Steuernummer gehört nicht ins Impressum.)*

**Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:**
{{NAME}}, Anschrift wie oben
*(Nur nötig, wenn die Seite journalistisch-redaktionelle Inhalte hat – etwa ein Blog oder
Versionshinweise, die mehr sind als eine Liste. Die App allein braucht die Zeile vermutlich
nicht. [verify])*

**Verbraucherstreitbeilegung**
Wir nehmen nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil
und sind dazu nicht verpflichtet.

Die Zahlung für die Unterstützer-Stufe wickelt {{MOR_LEGAL_NAME}} als Verkäufer ab.

Diese Anwendung nutzt die Discogs-API, ist aber nicht mit Discogs verbunden, wird nicht von
Discogs gesponsert oder unterstützt. „Discogs" ist eine Marke der Zink Media, LLC.

---

## English (convenience translation)

### Legal notice

Information under § 5 DDG

{{NAME}}
{{STREET}}
{{POSTCODE_CITY}}
Germany

**Contact**
Email: {{EMAIL}}
{{PHONE_OR_CONTACT}}

**VAT identification number** under § 27a UStG: {{VAT_ID_IF_ANY}}
*(Drop the line if there is none. A tax number does not belong in the notice.)*

**Responsible for content under § 18(2) MStV:**
{{NAME}}, address as above
*(Only needed if the site has journalistic-editorial content — a blog, say, or release notes
that are more than a list. The app alone probably does not need the line. [verify])*

**Consumer dispute resolution**
We do not take part in dispute resolution proceedings before a consumer arbitration board
and are not obliged to.

{{MOR_LEGAL_NAME}} handles payment for the supporter tier as the seller.

This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.

---

## Notes for filling it in

- **§ 5 DDG wants a postal address where documents can be served** — no P.O. box. A c/o
  address with real mail handling is what #252 plans; it has to be one where a letter
  actually reaches the operator. [verify that the chosen c/o service qualifies]
- **{{PHONE_OR_CONTACT}}**: § 5 DDG asks for a fast electronic route besides email. A phone
  number is the usual answer; a contact form answered promptly is accepted by the CJEU
  (C-298/07). Fill in one of them.
- **Gewerbe registration, trade register, supervisory authority for the business:** none of
  these lines apply to a sole trader without a register entry; add them only if #252 ends
  with one.
