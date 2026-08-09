# Golden-Fixture

Ein Miniatur-Universum: eine Sammlung von 24 Platten, eine Wantlist mit 3 Einträgen,
ein Horizont über 4 Entitäten, und ein Händlerinventar aus 60 Listings.

**Warum synthetisch und nicht ein echtes Inventar?**

Ein eingefrorenes echtes Inventar wäre Marktplatzdaten und dürfte nach sechs Stunden
nicht mehr im Repository stehen (`docs/09-LEGAL.md`). Die Struktur ist echt – Feldnamen,
Formatschreibweisen, Katalognummern, Mehrfachlabels –, die Inhalte sind erfunden.

**Wie „relevant" definiert ist**

Nicht nach meinem Geschmack, sondern per Konstruktion: `relevant.json` listet genau die
Listings, die eine der acht dokumentierten Beziehungen zur Sammlung haben
(`docs/04-MATCHING-ENGINE.md` §S1–S9). Alles andere ist ein Ablenker.

Die Ablenker sind der eigentliche Test. Sie enthalten:

- einen Künstlernamen, der einem bekannten ähnlich sieht, aber ein anderer ist
- ein Riesenlabel, von dem die Sammlung zufällig eine Platte hat
- eine Platte desselben Künstlers weit außerhalb der gesammelten Jahre
- eine CD, wo die Sammlung schon das Vinyl hat
- eine Katalognummer derselben Serie, aber 200 Nummern entfernt

Precision@5 misst, ob die Engine die Relevanten oben hat. Ziel laut
`docs/06-ROADMAP.md` M3: ≥ 0,6.
