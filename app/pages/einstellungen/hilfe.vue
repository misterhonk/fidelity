<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.help.title })

/**
 * The manual, in the app rather than on a website.
 *
 * Everything here was already true and already written down — in the code, in
 * `docs/`, in a comment somebody had to be reading the source to find. None of
 * that helps a person standing in front of a score of 74 wondering what it
 * means.
 *
 * Questions rather than headings, because that is the shape somebody arrives
 * in. Each answer is short enough to read standing up, and the ones that cost
 * requests say so in minutes.
 */
const CHAPTERS = [
  {
    title: 'Wie fange ich an?',
    body: [
      'Du brauchst einen Personal Access Token von Discogs – den erzeugst du dir unter „Settings → Developers" selbst. Danach holt Fidelity einmal deine Sammlung und deine Wantlist. Das ist die Grundlage: ohne sie weiß die App nicht, was du magst.',
      'Dann gibst du unter „Graben" einen Händler an – seinen Namen oder einfach den Link seiner Discogs-Seite. Fidelity liest sein Sortiment und sagt dir, was davon zu dir passt.',
    ],
  },
  {
    title: 'Was bedeutet die Zahl neben einer Platte?',
    body: [
      'Sie sagt, wie gut diese Platte zu deiner Sammlung passt – von 0 bis 100. Elf verschiedene Hinweise fließen ein: ein Künstler, den du sammelst, ein Wunsch auf deiner Wantlist, ein Label, dem du folgst, eine Lücke in einer Katalogserie, jemand, der auf deinen Lieblingsplatten im Kleingedruckten steht.',
      'Der stärkste Hinweis zählt voll, die übrigen zu je 30 Prozent. Eine Platte mit einem sehr guten Grund schlägt also eine mit drei schwachen – so wie ein Mensch es auch machen würde.',
      'Unter jeder Platte steht ein Satz, der sagt, warum. Wenn der Satz dich nicht überzeugt, ist die Zahl auch nichts wert. Tippst du die Platte an, siehst du jeden einzelnen Hinweis mit seinem Beleg.',
    ],
  },
  {
    title: 'Warum dauert ein Dig so lange?',
    body: [
      'Discogs lässt pro Minute nur eine begrenzte Zahl von Abfragen zu, und Fidelity hält sich daran – eine Anfrage nach der anderen, mit Abstand. Ein Laden mit dreitausend Platten sind also ein paar Minuten.',
      'Du kannst währenddessen weggehen. Der Fortschritt bleibt erhalten, auch wenn du den Tab schließt: beim nächsten Öffnen bietet die App an, dort weiterzumachen.',
      'Für Läden, die du schon einmal durchsucht hast, gibt es „nur das Neue" – das liest nur, was seit deinem letzten Besuch dazugekommen ist, und ist meist in Sekunden fertig.',
    ],
  },
  {
    title: 'Warum verschwinden die Preise nach ein paar Stunden?',
    body: [
      'Weil wir sie nicht länger behalten dürfen. Discogs erlaubt die Nutzung seiner Marktplatzdaten nur für kurze Zeit, und daran hält sich Fidelity ohne Ausnahme.',
      'Die Treffer und die Begründungen bleiben – die haben wir selbst errechnet. Nur die Preise und Zustände gehen. Im Korb bringt „Noch da?" alles auf den neuesten Stand.',
    ],
  },
  {
    title: 'Warum ein Korb pro Händler?',
    body: [
      'Weil Porto pro Sendung anfällt und nicht pro Platte. Zwei Platten bei zwei Läden sind zweimal Versand; zwei Platten bei einem Laden oft einmal.',
      'Deshalb rechnet jeder Korb für sich: Zwischensumme, Versandstaffel, und was jede weitere Platte tatsächlich kostet. Gekauft wird bei Discogs – Fidelity legt nichts in einen fremden Warenkorb.',
    ],
  },
  {
    title: 'Was ist der Horizont?',
    body: [
      'Alles, was Fidelity über deine Künstler und Labels herausgefunden hat – nicht nur das, was bei dir im Regal steht. Damit erkennt die App andere Pressungen derselben Platte, Lücken in Katalogserien und Alben, die du noch nicht kennst.',
      'Er wird einmal aufgebaut und danach nur noch nachgeführt. Ohne ihn funktioniert alles, aber die interessanteren Treffer bleiben unsichtbar.',
    ],
  },
  {
    title: 'Und die Credits?',
    body: [
      'Aus den Platten, die du bei Discogs mit vier oder fünf Sternen bewertet hast, liest Fidelity heraus, wer sie gemacht hat: Produzenten, Remixer, Studioleute.',
      'Wenn dieselbe Person oft auftaucht, findet die App später auch Platten, auf denen sie nicht vorne draufsteht. Das ist der Unterschied zwischen „nach Künstler suchen" und einem Menschen, der den Laden kennt.',
    ],
  },
  {
    title: 'Wo liegen meine Daten?',
    body: [
      'Auf diesem Gerät, im Speicher deines Browsers. Es gibt keinen Server, an den sie gehen könnten – Fidelity besteht nur aus Dateien, die in deinem Browser laufen.',
      'Dein Discogs-Token bleibt ebenfalls hier. Er wird nie in eine Adresse geschrieben, nie protokolliert und an niemanden weitergegeben.',
      'Fidelity liest nur. Es ändert nichts an deinem Discogs-Konto, kauft nichts und schreibt nichts zurück.',
    ],
  },
  {
    title: 'Wie bekomme ich alles auf mein Handy?',
    body: [
      'Unter „Geräte abgleichen". Deine Daten werden auf diesem Gerät verschlüsselt und als ein einziger Block abgelegt – wahlweise in deinem Hub, in einem Sync-Ordner, bei Dropbox oder Google Drive. Nur deine Geräte können ihn wieder öffnen.',
      'Alternativ richtest du das Handy einfach neu ein. Alles außer deinen Urteilen lässt sich von Discogs neu holen.',
    ],
  },
  {
    title: 'Funktioniert das ohne Netz?',
    body: [
      'Zum Nachschlagen ja. Sammlung, Wantlist, Landkarte und die letzten Fundlisten liegen auf dem Gerät. Der Bildschirm „Im Laden" ist genau dafür da: mit der Platte in der Hand nachsehen, ob du sie schon hast – Plattenläden sind Keller.',
      'Neue Digs brauchen Netz, denn dafür muss der Laden gelesen werden.',
    ],
  },
  {
    title: 'Etwas stimmt nicht',
    body: [
      'Unter „Deine Daten" kannst du alles ausgeben oder alles löschen. Löschen entfernt auch den Token – danach ist das Gerät leer und du kannst von vorne anfangen. Verloren geht dabei nichts, was sich nicht von Discogs neu holen ließe.',
      'Sagt die App, Discogs sei nicht erreichbar, obwohl du online bist: meist ist das Anfragebudget für den Moment aufgebraucht. Ein paar Minuten warten hilft.',
    ],
  },
]
</script>

<template>
  <SettingsPage :title="st.help.title" :lead="st.help.lead">
    <!--
      Offen, nicht zugeklappt.

      A page somebody opened *because* they have a question should not make
      them guess which of eleven closed boxes holds it. It is a manual, and a
      manual is read by scanning.
    -->
    <div class="flex flex-col gap-8">
      <section v-for="chapter in CHAPTERS" :key="chapter.title" class="flex flex-col gap-2">
        <h2 class="text-fid-base font-medium text-fid-text">{{ chapter.title }}</h2>
        <p
          v-for="(paragraph, index) in chapter.body"
          :key="index"
          class="max-w-prose text-fid-sm text-fid-text-muted"
        >
          {{ paragraph }}
        </p>
      </section>

      <section class="flex flex-col gap-2 border-t border-fid-border pt-6">
        <h2 class="text-fid-base font-medium text-fid-text">Noch eine Frage offen?</h2>
        <p class="max-w-prose text-fid-sm text-fid-text-muted">
          Fidelity ist quelloffen einsehbar – wie es rechnet, steht im Code, und warum es so
          rechnet, in den Unterlagen daneben. Wer genauer wissen will, wie eine Punktzahl
          zustande kommt, findet das dort vollständig aufgeschrieben.
        </p>
        <p class="text-fid-xs text-fid-text-muted">
          Diese Anwendung nutzt die Discogs-API, steht aber in keiner Verbindung zu Discogs.
        </p>
      </section>
    </div>
  </SettingsPage>
</template>
