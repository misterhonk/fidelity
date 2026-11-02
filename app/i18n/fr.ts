/**
 * French — a translation, not the original. See ADR-010.
 *
 * Loaded on demand, like `de.ts`: whoever reads English or German never
 * downloads this file. Typed as `Messages`, so a key missing here fails
 * `pnpm typecheck` by name.
 *
 * The voice (docs/20, checked in tests/unit/voice.spec.ts): the person behind
 * the counter says "tu", never "vous"; a space goes before `?`, `:`, `;` and
 * `%`, as French writes them; "fouille" is a dig.
 */

import type { Messages } from './en'

/** French counts nought and one in the singular: "0 disque", "1 disque", "2 disques". */
const counted = (n: number, one: string, many: string) => `${n} ${n < 2 ? one : many}`

const fr: Messages = {
  meta: {
    name: 'Français',
    locale: 'fr-FR',
  },

  when: {
    justNow: 'à l’instant',
    yesterday: 'hier',
  },

  common: {
    signIn: { lead: 'Connecte-toi d’abord,', link: 'va à la page d’accueil' },
    atDiscogs: (title) => `${title}, voir sur Discogs`,
    openRecord: (title) => `Ouvrir ${title}`,
    toTop: 'Revenir en haut',
    opensAtDiscogs: '(s’ouvre sur Discogs)',
    nothingYet: 'Rien récupéré pour l’instant',
    off: 'Désactivé',
    never: 'jamais',
    ofTotal: (done: string | number, total: string | number) => `${done} sur ${total}`,
    loading: 'Chargement …',
    stop: 'Arrêter',
    progressAt: (label, percent) => `${label} : ${percent} %`,
    asking: 'On demande …',
    searching: 'Recherche …',
    save: 'Enregistrer',
    to: 'à',
    etaLeft: (clock: string) => `· encore env. ${clock}`,
  },

  listen: {
    title: 'Écouter',
    search: (service) => `Chercher sur ${service}`,
    source: 'Lecture depuis YouTube',
    consent: {
      lead: 'Lire les extraits ici même ?',
      what: 'Le lecteur vient de YouTube. Google voit alors l’adresse de cet appareil et le disque qui joue. Dès la lecture, YouTube peut stocker et lire des informations sur cet appareil, comme des cookies. Ta collection et ton token restent ici. Rien ne se charge avant que tu appuies sur lecture.',
      yes: 'Lire ici',
      settings: 'Tu peux le désactiver dans Réglages → Recherche.',
    },
    stop: 'Arrêter',
    onIt: 'Sur le disque',
    via: 'YouTube',
    play: (track) => `Lire ${track}`,
    more: 'Autres enregistrements',
  },

  grades: {
    M: 'Scellé ou jamais joué.',
    NM: 'Semble neuf, à peine joué. Aucun souffle notable.',
    VGP: 'Légères traces d’usage. Joue proprement, peut-être un craquement entre les morceaux.',
    VG: 'Traces visibles. Un souffle qu’on entend dans les passages calmes.',
    GP: 'Beaucoup joué. Souffle continu, mais il passe.',
    G: 'Très joué. Un exemplaire à posséder, pas à écouter.',
    F: 'Abîmé. Passe jusqu’au bout, au mieux.',
    P: 'Cassé ou injouable.',
  },

  limit: {
    title: 'Requêtes à Discogs',
    session: 'Cette session',
    purposes: {
      dig: 'Fouilles',
      horizon: 'Horizon',
      record: 'Disques',
      watch: 'Veille',
      sync: 'Collection',
      other: 'Autre',
    },
    spoken: (n, ceiling) =>
      `${n} requêtes dans la dernière minute, sur les ${ceiling} que cet appareil s’autorise`,
    saved: (n, minutes) =>
      `Le catalogue et le hub nous ont épargné ${n} requêtes, environ ${minutes === 1 ? 'une minute' : `${minutes} minutes`} d’attente.`,
    ceiling: (n) =>
      `Discogs autorise 60 par minute et par adresse. On en demande ${n}, exprès.`,
    ours: 'On compte ce qu’on a demandé. Le compteur de Discogs, un navigateur ne peut pas le lire.',

    noToken:
      'Sans token : 25 par minute au lieu de 50. Une fouille prend deux fois plus de temps.',
    tryCatalogue: (n) =>
      `Un catalogue aurait répondu à ${n} d’entre elles sans demander à Discogs.`,
    tryHub: (_n) =>
      'Un hub les partage entre tes appareils, et avec tous ceux qui l’utilisent.',
    costs: 'Ce qui prend combien de temps',
    costRows: (n, d) => [
      [`Une fouille, ${n(3000)} annonces`, '~ 130', '~ 2½ min'],
      [`Une fouille, ${n(20000)} annonces`, '~ 300', '~ 6 min'],
      ['Tes artistes et labels, 30 en tout', '~ 600', '~ 12 min'],
      [`Récupérer la collection, ${n(2000)} disques`, '~ 40', '~ 1 min'],
      ['La tournée, par boutique suivie', '~ 20', '~ 25 s'],
      ['Ouvrir un disque', '1', `${d(1.2)} s`],
    ],
  },

  notice: {
    offline: {
      title: 'Tu es hors ligne.',
      body: 'Ton étagère, la carte et les dernières fouilles sont là. Les nouvelles fouilles, la synchro et les prix du marché ont besoin du réseau.',
    },
    install: {
      title: 'Mettre sur ton téléphone',
      got_it: 'Compris',
      body_before: 'Dans Safari, appuie en bas sur',
      share: 'Partager',
      body_middle: ', puis sur',
      addToHome: 'Sur l’écran d’accueil',
      body_after:
        '. Ce n’est que depuis l’écran d’accueil qu’iOS permet les notifications et la pastille. Et ce n’est que là que ce qui est ici reste enregistré, au lieu de disparaître au bout d’une semaine. Marche aussi au sous-sol, sans réseau.',
    },
    update: {
      title: 'Une nouvelle version est prête.',
      later: 'Plus tard',
      reload: 'Recharger',
    },
  },

  error: {
    detail: 'Ce que Discogs a dit exactement',
    unknown: 'Quelque chose a mal tourné.',

    hubUnreachable: {
      title: 'Rien ne répond à cette adresse.',
      action: 'Le hub tourne-t-il, et l’adresse et le port sont-ils les bons ?',
    },
    hubMixedContent: {
      title: 'Injoignable d’ici.',
      action:
        'Cette page passe par HTTPS et ne peut donc pas appeler une adresse non chiffrée. Dans Chrome, ça passe ; la seule solution durable est de rendre le hub joignable en HTTPS.',
    },
    scanRunning: (dealer: string) => ({
      title: `On fouille déjà chez ${dealer}.`,
      action:
        'Une fouille à la fois, Discogs ne nous en laisse pas plus. Elle continue en arrière-plan, et cet écran la montre. Tu lanceras la suivante quand elle sera finie.',
    }),
    hubHttpError: (status) => ({
      title: `Le hub a répondu HTTP ${status}.`,
      action: 'C’est le hub qui le dit, pas Discogs. Son propre journal en sait plus.',
    }),

    oauthMismatch: 'La réponse du fournisseur ne correspond pas à cette demande.',
    oauthNoToken: 'Le fournisseur n’a pas envoyé de clé d’accès.',
    noFilePicker: 'Ce navigateur ne sait pas choisir de fichier.',
    noFileChosen: 'Aucun fichier choisi pour l’instant.',
    fileUnreadable: 'Le fichier ne contient pas de coffre lisible.',
    fileDenied: 'Le navigateur n’a pas autorisé l’accès au fichier.',
    notAVault: 'Ce fichier n’est pas un coffre Sleeveside.',
    oauthRejected: (provider) => `${provider} a refusé le code.`,
    notConnected: 'Pas encore connecté.',
    connectionExpired: 'La connexion a expiré. Reconnecte-toi.',
    refreshFailed: 'La connexion n’a pas pu être renouvelée.',
    vaultNotGiven: (provider) => `${provider} n’a pas rendu le coffre.`,
    vaultNotTaken: (provider) => `${provider} n’a pas accepté le coffre.`,
    vaultNotCreated: (provider) => `${provider} n’a pas créé le coffre.`,
    providerUnexpected: (provider) => `${provider} ne répond pas comme prévu.`,
    noCloudTarget: 'Pas de destination dans le cloud.',

    failed: {
      'no-token': {
        title: 'Aucun token saisi.',
        action: 'Colle ton Personal Access Token de Discogs dans le champ.',
      },
      'not-signed-in': {
        title: 'Pas connecté.',
        action: 'Saisis ton token Discogs dans les réglages. Tout ici en a besoin.',
      },
      'outbox-pending': {
        title: 'Certaines modifications ne sont pas encore chez Discogs.',
        action:
          'Te déconnecter maintenant les efface pour de bon. Reviens en ligne et attends un peu, ou déconnecte-toi quand même.',
      },
      'no-listing': {
        title: 'Aucun disque indiqué.',
        action: 'Colle un lien vers un disque dans une boutique Discogs.',
      },
      'listing-gone': {
        title: 'Le disque est vendu.',
        action: 'Prends-en un autre, ou colle le lien d’un disque encore disponible.',
      },
      'dig-gone': {
        title: 'Cette fouille n’existe plus.',
        action:
          'On garde une fouille six heures, ensuite ses prix disparaissent. Refouille la boutique.',
      },
      'dig-expired': {
        title: 'Les prix ont plus de six heures.',
        action:
          'Des prix aussi vieux, on ne peut pas les montrer. Une nouvelle fouille prend une minute.',
      },
      'dig-running': {
        title: 'Une fouille est déjà en cours.',
        action: 'Une à la fois, Discogs ne nous en laisse pas plus. Laisse-la finir.',
      },
      'harvest-running': {
        title: 'Les crédits sont déjà en cours de lecture.',
        action: 'Un seul passage à la fois. Il continue même si tu quittes l’écran.',
      },
      'round-running': {
        title: 'La tournée est déjà en cours.',
        action: 'Une tournée à la fois. Elle continue même si tu quittes l’écran.',
      },
      'round-recent': {
        title: 'La tournée est passée il y a quelques minutes.',
        action: 'Rien n’arrive aussi vite dans les boutiques. Donne-lui dix minutes.',
      },
      'dig-not-running': {
        title: 'Rien à reprendre ici.',
        action:
          'Cette fouille n’est pas en cours. Lance une nouvelle fouille dans la boutique.',
      },
      'deep-scan-done': {
        title: 'Une fouille en profondeur ne se reprend pas.',
        action: 'Ce qu’elle a trouvé est là. La reprendre compterait des disques deux fois.',
      },
      'no-anchor': {
        title: 'Rien à comparer pour l’instant.',
        action:
          '« Seulement le nouveau » a besoin d’une fouille complète de cette boutique pour commencer.',
      },
      'match-gone': {
        title: 'Cette trouvaille n’existe plus.',
        action: 'Elle est partie avec sa fouille au bout de six heures. Refouille la boutique.',
      },
      'no-hub': {
        title: 'Aucun hub saisi.',
        action: 'Un hub est facultatif. Saisis-en un dans les réglages, ou laisse tomber.',
      },
      'not-a-hub': {
        title: 'Ce n’est pas un hub Sleeveside.',
        action:
          'Quelque chose répond à cette adresse, mais pas un hub. Vérifie l’adresse et le port.',
      },
      'no-catalogue': {
        title: 'Aucun catalogue saisi.',
        action:
          'Un catalogue est facultatif. Saisis-en un dans les réglages, ou laisse tomber.',
      },
      'not-a-catalogue': {
        title: 'Ce n’est pas un catalogue Sleeveside.',
        action:
          'Quelque chose répond à cette adresse, mais pas un catalogue. Vérifie l’adresse et le port.',
      },
      'not-a-backup': {
        title: 'Ce n’est pas une sauvegarde Sleeveside.',
        action:
          'Une sauvegarde, c’est le fichier qu’écrit « Tout exporter » ici : sleeveside-backup-<date>.json.',
      },
      'backup-too-new': {
        title: 'Cette sauvegarde vient d’une version plus récente de Sleeveside.',
        action:
          'Mets d’abord l’appli à jour. Une plus ancienne la lirait mal au lieu de ne pas la lire.',
      },
      'token-other-account': {
        title: 'Ce token appartient à un autre compte Discogs.',
        action:
          'Ce qui est sur cet appareil appartient au compte connecté. Pour changer de compte, déconnecte-toi d’abord, ce qui efface la base, puis connecte-toi avec le nouveau token.',
      },
      'vault-too-new': {
        title: 'Cette copie vient d’une version plus récente de Sleeveside.',
        action:
          'Mets d’abord l’appli à jour. Une plus ancienne la lirait mal au lieu de ne pas la lire.',
      },
      'malformed-payload': {
        title: 'Impossible de lire ça.',
        action:
          'C’est abîmé ou ça ne vient pas de Sleeveside. Rien n’a changé sur cet appareil.',
      },
      'vault-unusable': {
        title: 'Cette destination de copie est inutilisable.',
        action: 'Jette un œil à la destination dans les réglages.',
      },
      'passphrase-short': {
        title: 'La phrase secrète est trop courte.',
        action:
          'Huit caractères au moins. C’est la seule chose entre la copie et la personne qui la trouve.',
      },
      'asset-missing': {
        title: 'Une partie de l’appli n’est pas chargée.',
        action: 'Recharge la page. Si ça continue, la livraison est incomplète.',
      },
      'off-discogs': {
        title: 'Une requête voulait sortir de Discogs. Elle est arrêtée.',
        action: 'Ton token n’est pas parti. C’est un bug, signale-le s’il te plaît.',
      },
    },

    tokenRevoked: {
      title: 'Discogs n’accepte plus le token.',
      action:
        'Il a sans doute été révoqué chez Discogs. Crées-en un nouveau dans les réglages développeur et saisis-le sous Réglages → Compte → Renouveler le token. Tes données ici restent où elles sont.',
    },
    tokenUnknown: {
      title: 'Discogs ne connaît pas ce token.',
      action:
        'Le plus souvent, quelque chose a glissé au copier : une espace, ou un caractère qui manque à la fin. Reprends-le dans les réglages développeur et colle-le en entier.',
    },
    rateLimited: {
      title: 'Discogs demande une pause.',
      action: 'Tout jusqu’ici est enregistré. Une ou deux minutes, et on reprend la fouille.',
    },
    offline: {
      title: 'On n’arrive pas à joindre Discogs.',
      action:
        'Ton étagère, la carte et les dernières fouilles sont là. Les nouvelles fouilles ont besoin du réseau.',
    },
    storageFull: {
      title: 'Plus de place sur cet appareil.',
      action:
        'Le navigateur ne nous donne plus de stockage. Les vieilles fouilles partent de toute façon au bout de six heures ; « Tout effacer » sur la page d’accueil fait le reste.',
    },
  },

  why: 'Pourquoi ?',

  freshness: {
    looking: 'On regarde …',
    nothingNew: 'Rien de neuf.',
    added: (records) => `${counted(records, 'disque ajouté', 'disques ajoutés')}`,
    alerts: (shops) => `${counted(shops, 'boutique a', 'boutiques ont')} du nouveau`,
    undone: (titles) =>
      titles.length === 1
        ? `« ${titles[0]} » n’est pas arrivé chez Discogs. On a annulé la modification.`
        : `On a annulé ${new Intl.ListFormat('fr').format(titles.map((t) => `« ${t} »`))}. Ils ne sont pas arrivés chez Discogs.`,
    asOf: (when) => `État au ${when}`,
    refreshAll: 'Tout rafraîchir',

    updating: 'On rafraîchit tes données',
    job: {
      outbox: 'tes modifications partent',
      library: 'collection et liste d’envies',
      watch: 'les boutiques que tu suis',
      horizon: 'tes artistes et labels',
    },
  },

  news: {
    title: 'Quoi de neuf',
    whatToDo: 'À faire :',
    updatedTo: (version) => `Maintenant en ${version}`,
    whatChanged: 'Qu’est-ce qui a changé ?',
    dismiss: 'Plus tard',
    inVersion: (version) => `Dans la version ${version}`,
    none: 'Rien n’est écrit sur cette version.',
    german:
      'Les notes jusqu’à 0.26.0 sont en allemand ; elles viennent des commits de ce projet.',
    full: 'Toutes les versions, sur GitHub',
    fullHref: 'https://github.com/misterhonk/fidelity/blob/main/CHANGELOG.md',
  },

  token: {
    title: 'Saisir le token',
    lead: 'On parle directement à Discogs, sans serveur au milieu. Pour ça, il nous faut un token personnel, que tu crées toi-même.',
    sampleTitle: 'Ce que ça donne',
    sampleNote:
      'Des exemples. Une note et une phrase qui dit pourquoi, pour chaque disque d’une boutique. Dès que ta collection est là, ce sont tes artistes et tes labels qui y figurent.',
    what: 'Un token marche comme un mot de passe, mais seulement pour l’API Discogs, et tu peux le révoquer à tout moment.',
    step1: 'Ouvre',
    step2: 'Appuie sur « Generate new token »',
    step3: 'Copie-le et colle-le ici',
    picture: {
      alt: 'Les réglages développeur de Discogs, avec le bouton « Generate new token »',
      heading: 'Personal access token',
      button: 'Generate new token',
    },
    field: 'Personal Access Token',
    paste: 'Coller',
    pasteFailed:
      'Le presse-papiers est resté fermé. Appuie longuement sur le champ et colle-le là.',
    show: 'Afficher',
    revoke: 'Révocable à tout moment chez Discogs',
    readsOnly: 'On lit. Seul toi modifies.',
    readsOnlyRest:
      'Ta collection, ta liste d’envies et ce qu’ont les boutiques. Seul ce que tu changes ici part chez Discogs : notes, dossiers, achats, la liste d’envies. L’achat se fait là-bas, par toi.',
    staysHere:
      'Le token reste sur cet appareil et ne part chez personne, pas même chez nous. Il n’y a aucun serveur pour le recevoir.',
    checking: 'Vérification …',
    signIn: 'Se connecter',

    renewTitle: 'Renouveler le token',
    renewLead:
      'Si Discogs n’accepte plus le token, saisis-en un nouveau ici. Tout reste sur cet appareil ; seule la clé change.',
    renew: 'Renouveler',
    renewed: 'Le token marche. Rien d’autre n’a changé.',
  },

  signals: {
    WANTLIST_EXACT: 'Liste d’envies',
    WANTLIST_PRESSING: 'Autre pressage',
    ARTIST_KNOWN: 'Artiste',
    ARTIST_FOLLOWED: 'Dans le viseur',
    ARTIST_GAP: 'Trou',
    LABEL_AFFINITY: 'Label',
    CATALOG_RUN: 'Série',
    STYLE_ADJACENT: 'Style',
    CREDIT_GRAPH: 'Crédits',
    FORMAT_UPGRADE: 'Upgrade',
    PRICE_SIGNAL: 'Prix',
    SCARCITY: 'Rareté',
  },

  home: {
    title: 'Aujourd’hui',
    description: 'Sleeveside, la personne derrière le comptoir pour tes fouilles sur Discogs.',
    inStore: 'En boutique',
    counts: {
      collection: 'Collection',
      wantlist: 'Envies',
      marked: 'Notés',
      dealers: 'Boutiques',
      basket: 'Au panier',
    },
    lastFound: 'Dernières trouvailles',
    interrupted: (scanned, total) => `Cette fouille s’est arrêtée à ${scanned} sur ${total}.`,
    carryOn: 'Reprendre là',
    pricesGone:
      'Les prix avaient plus de six heures, on les a retirés. Les trouvailles et leurs raisons restent.',
    whyThese: 'Pourquoi celles-ci ?',
    newOnShelf: 'Nouveau sur l’étagère',
    lastNoted: 'Dernières notes',
    owned: (n) => `${n} disques`,
    wanted: (n) => `${n} ${n === '1' || n === '0' ? 'envie' : 'envies'}`,
    yourShops: 'Tes boutiques',
    forSale: (n: string) => `${n} en vente`,
    whatIsHere: 'Ce qu’il y a ici',
  },

  nextStep: {
    library: {
      cta: 'Récupérer la collection',
      title: 'D’abord : récupérer ta collection',
      body: 'Sans elle, on ne sait pas ce que tu aimes. Quelques secondes par millier de disques, et elle est sur cet appareil.',
    },
    horizon: {
      cta: 'Chercher tes artistes',
      title: 'Ensuite : chercher tes artistes et tes labels',
      body: (minutes) =>
        `Une fois, environ ${counted(minutes, 'minute', 'minutes')}. Ta prochaine fouille reconnaîtra aussi les producteurs, les séries de catalogue et les autres pressages de tes disques.`,
    },
    dig: {
      cta: 'Lancer une fouille',
      title: 'Maintenant : fouiller une première boutique',
      body: 'Prends-en une où tu achètes de toute façon. Deux à quatre minutes pour vingt mille disques, et à la fin tu as une liste avec une phrase pour chaque trouvaille.',
    },
    again: {
      cta: 'Refouiller',
      title: (dealer) =>
        `Refouiller ${dealer}, maintenant avec producteurs, séries et pressages`,
      body: 'Ta première fouille ne connaissait que ton étagère. Maintenant elle sait aussi qui a produit tes disques, quelles séries de catalogue tu collectionnes et quels autres pressages existent.',
    },
  },

  palette: {
    placeholder: 'Artiste, titre, label, n° de catalogue, boutique, lien …',
    nothing: 'Rien trouvé. Disques, fouilles et boutiques apparaissent ici dès qu’il y en a.',
    shelf: 'Sur l’étagère',
    wantlist: 'Sur la liste d’envies',
    actions: 'Actions',
    digAt: (shop) => `Fouiller chez ${shop}`,
    scan: 'Lire un code-barres',
    settings: (page) => `Réglages : ${page}`,
    results: 'Résultats',
    goTo: 'Aller à',
    dealers: 'Boutiques',
    digs: 'Fouilles',
    lastDig: 'Dans la dernière fouille',
    inStore: 'En boutique',
    affinity: (rate) => `${rate} trouvailles pour mille`,
    digHint: (matches, when) => `${matches} trouvailles · ${when}`,
    label: 'Commandes et recherche',
    search: 'Chercher',
  },

  watch: {
    whyLabel: 'Comment on compte',
    why: 'Le total de la boutique, pas le nombre de disques nouveaux. Qui en vend cinq et en met cinq en vente bouge de zéro. Une fouille dit ce qu’il y a là-dedans pour toi.',
    sinceLastVisit: 'Depuis ta dernière visite',
    moreListings: (n: number, one: boolean) =>
      `${one ? 'annonce' : 'annonces'} de plus que la dernière fois.`,
    read: 'Lu',
    nothingNew: 'Rien de neuf pour toi là-dedans.',
    moved: (n: string, one: boolean) =>
      `a ${n} ${one ? 'annonce' : 'annonces'} de plus que la dernière fois.`,
  },

  catalogRun: 'Plein = sur l’étagère. Cerclé = ce disque.',
  catalogRunEntry: {
    this: (number) => `${number}, ce disque`,
    owned: (number) => `${number}, tu l’as`,
    missing: (number) => `${number}, il te manque`,
  },

  credits: {
    title: 'Qui a travaillé dessus',
    look: 'Regarder',
    about:
      'Le plus grand trésor inexploité de Discogs : qui a produit, mixé ou masterisé. On le sait déjà, la réponse arrive tout de suite.',
    hereOnly: (here) => `${here} ici, dont tu n’as encore rien.`,
    youHave: (owned, here) => `Tu en as ${owned}. Cette boutique en a ${here} de plus.`,
    records: (n) => counted(n, 'disque', 'disques'),
  },

  inStore: {
    title: 'En boutique',
    description: 'Tes trouvailles pour la main dans le bac. Hors ligne, grandes cibles.',
    back: 'Retour',
    offline: 'hors ligne, tout vient de l’appareil',
    interrupted: (scanned, total) =>
      `Cette fouille s’est arrêtée à ${scanned} sur ${total}, ce qui est là n’est donc pas tout.`,
    noDig:
      'Pas encore de fouille, la liste reste donc vide. Tu peux quand même chercher dans ta collection et ta liste d’envies, même sans réseau.',
    expired:
      'Plus de six heures, les prix et les états sont donc partis. Les trouvailles et leurs raisons restent.',
    yourMax: (amount) => `ton prix max ${amount}`,
    scan: 'Lire un code-barres',
    scanning: 'Recherche …',
    scanStop: 'Annuler',
    scanDenied: 'La caméra est restée fermée. Tu peux aussi taper.',
    scanNotHere:
      'Ce navigateur ne sait pas lire de code-barres ; Safari n’a pas de lecteur intégré. Tape les chiffres, ça trouve la même chose. Sur iPhone : appuie dans le champ, puis sur le bouton Texte en direct dans la barre du clavier. La caméra lit les chiffres pour toi.',
    scanOwned: (copies) => `Tu l’as, ${copies} dans la collection.`,
    scanWanted: 'Pas dans la collection. Sur ta liste d’envies.',
    scanOwnedAlbum: (copies) =>
      `Tu as l’album, ${copies} dans la collection, dans un autre pressage.`,
    scanWantedAlbum:
      'Pas dans la collection. Un autre pressage de cet album est sur ta liste d’envies.',
    scanNew: 'Ni dans la collection ni sur la liste d’envies.',
    scanPressings: (n) =>
      `${n} pressages partagent ce code-barres. Un code-barres désigne une sortie, pas un pressage.`,
    scanNothing: 'Discogs ne connaît aucun disque avec ce code-barres.',
    identify: 'Chercher',
    identifyLabel: 'Code-barres, n° de catalogue ou nom',
    identifyPlaceholder: 'Code-barres, n° de catalogue, artiste ou titre',
    kind: {
      barcode: 'Un code-barres. Chercher montre les pressages.',
      catno: 'Un n° de catalogue ou de matrice. Chercher montre le pressage.',
      text: 'Artiste ou titre. Cherché pendant que tu tapes.',
    },
    identifyLater: 'Garder pour plus tard',
    queued: (n) =>
      `${n} ${n < 2 ? 'attend' : 'attendent'} le réseau. Dès qu’il revient, on cherche.`,
    resolved: 'Cherché quand le réseau est revenu',
    pressing: {
      pick: 'Lequel as-tu en main ? Appuie dessus, et on le lit face à tous les pressages de l’album.',
      check: 'Quel pressage est-ce ?',
      reading: 'Lecture du pressage …',
      noAnswer: 'Discogs n’a pas répondu, le pressage reste non lu. La liste tient.',
      onlyItself: 'Discogs ne connaît aucun autre pressage, donc rien à comparer.',
      among: (total, year) =>
        `Un des ${total} pressages, et un des premiers : l’album est de ${year}.`,
      later: (total, year) => `Un des ${total} pressages. Les premiers sont de ${year} :`,
      firstOnes: 'Les premiers pressages',
      you: 'le tien',
      onDiscogs: 'Sur Discogs',
    },
    finds: (n: number) => `${n} ${n < 2 ? 'trouvaille' : 'trouvailles'}`,
    wrong: 'À côté',
    notInLibrary: 'Ni dans ta collection ni sur ta liste d’envies',
    norLastDig: ', et la dernière fouille ne le connaît pas non plus',
    nothingByName: 'Rien sous ce nom.',
    pressings: (n: number) => `${n} pressages`,
    youWant: 'Tu le cherches',
    youOwn: 'Tu l’as',
    stands: {
      all: (n) => `Les ${n} stands`,
      chip: (name, finds) => `${name} · ${finds}`,
      line: (stands, finds) => `${stands} stands · ${finds}`,
      lead: 'Les boutiques que tu as fouillées ces dernières 24 heures. Une liste par stand, ou toutes à la fois. Chaque panier reste son propre colis.',
      interrupted: (dealer, scanned, total) =>
        `${dealer} : arrêté à ${scanned} sur ${total}, ce qui est là pour ce stand n’est donc pas tout.`,
    },
  },

  discovery: {
    search: 'Chercher des boutiques sur Discogs',
    searching: 'Recherche …',
    about:
      'Dans tes commandes, où Discogs ne nous montre que le côté vente : les boutiques qui t’ont acheté, pas celles où tu as acheté. Si tu l’autorises dans les réglages, aussi dans ta liste d’amis Discogs, et pour la plupart des gens c’est la moitié qui trouve quelque chose. Une requête par source, puis une par candidat, pour voir qui vend vraiment.',
    added: (n) => (n === 1 ? 'Une boutique ajoutée.' : `${n} boutiques ajoutées.`),
    take: (n) => `En prendre ${n}`,
    listings: (n: string) => `${n} annonces`,
    alreadyThere: 'déjà là',
    hide: 'Ne jamais proposer',
    hideWhy: 'Ne plus jamais proposer cette boutique',
    nothing: 'La recherche n’a trouvé aucune nouvelle boutique.',
    whereLabel: 'Où on cherche',
    friendsSummary: 'Lire aussi ma liste d’amis Discogs ?',
    sources: {
      order: 'Depuis tes commandes (côté vente)',
      friend: 'Des amis qui vendent des disques',
    },
    sourceAbout: {
      order: 'Depuis tes commandes Discogs.',
      friend: 'Depuis ta liste d’amis, et seulement ceux qui vendent vraiment des disques.',
    },
  },

  evidence: {
    artist: 'Artiste',
    album: 'Album',
    label: 'Label',
    person: 'Personne',
    owned: 'sur l’étagère',
    total: 'discographie',
    ownedAs: 'tu as',
    styles: 'Styles',
    similarity: 'Proximité',
    lift: 'Lift',
    share: 'Part',
    prefix: 'Série',
    number: 'Numéro',
    inRun: 'dans la série',
    wantedYear: 'voulu',
    pressingYear: 'ce pressage',
    price: 'Prix',
    marketLowest: 'Prix plancher du marché',
    ratio: 'Rapport',
    numForSale: 'en vente',
  },
  close: 'Fermer',
  skipToContent: 'Aller au contenu',
  cancel: 'Annuler',
  mainReleases: (n) => `${n} sorties principales`,
  decade: (year) => `années ${year}`,

  demo: {
    title: 'D’abord, regarder',
    lead: 'Choisis un disque. On te montre ce qui va avec dans la même boutique. Sans connexion.',
    listing: 'Un disque d’une boutique Discogs',
    look: 'Regarder',
    orOne: 'Ou un de ceux-ci :',
    moment: 'Un instant …',
    fetching: 'On récupère le disque …',
    reading: (page, pages) => `On lit le stock, page ${page} sur ${pages} au plus`,
    comparing: 'On compare …',
    progress: 'Progression',
    fitsAt: (dealer) => `Chez ${dealer}, ça va avec`,
    score: (score) => `Barry Score ${score} sur 100`,
    nothing:
      'Rien à côté cette fois. Un disque, c’est un indice mince, ta collection un épais. Voilà à quoi ressemblent les trouvailles :',
    coverage: (scanned, total) =>
      `On a lu ${scanned} disques sur ${total}, avec un seul disque comme indice. Une fouille lit toute la boutique et connaît ta collection.`,
    shopLogo: (dealer: string) => `${dealer}, enseigne`,
    takesAMinute: 'Ça prend à peine une minute.',
  },

  nav: {
    label: 'Sections principales',
    start: { label: 'Aujourd’hui', hint: 'Ce qui est neuf, ce qui t’attend' },
    dig: { label: 'Fouiller', hint: 'Fouiller une boutique' },
    basket: { label: 'Panier', hint: 'Ce que tu veux acheter' },
    shelf: { label: 'Collection', hint: 'Ce que tu as et ce que tu cherches' },
    dealers: { label: 'Boutiques', hint: 'Chez qui tu achètes' },
    search: { label: 'Recherche', hint: 'Disques, boutiques et actions' },
    profile: { label: 'Profil', hint: 'Réglages : token, synchro, apparence' },
    inBasket: (count) => `${count} au panier`,
    digRunning: (percent) => `Fouille en cours, ${percent} %`,
    attribution: 'Données de Discogs',
    disclaimer:
      'Cette application utilise l’API de Discogs, mais n’est ni affiliée à Discogs, ni sponsorisée, ni approuvée par Discogs. « Discogs » est une marque de Zink Media, LLC.',
    privacy: 'Confidentialité',
    legal: 'Mentions légales',
    compared: 'En comparaison',
  },
}

export default fr
