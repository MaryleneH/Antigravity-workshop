/* Contenu partagé par les 5 maquettes de la page d'accueil (novembre 2026).
   Tout est tiré du site actuel : mêmes textes, mêmes romans, mêmes images.
   Les chemins sont relatifs au dossier _maquettes/. */
window.MG = {
  auteure: {
    nom: "Mo Gadarr",
    signature: "Auteure de New Romance engagée",
    accroche: "Une New Romance engagée qui bouscule les cœurs.",
    bio: "Professeur de français et auteure hybride, Mo Gadarr mêle romance et sujets de société pour créer une « Romance engagée ». D'abord découverte sur Fyctia avec Black Feelings, elle captive désormais ses lecteurs chez Black Ink et en auto-édition.",
    bioLongue: "Professeur de français, Mo Gadarr s'inspire de son quotidien et de l'actualité pour écrire ses romances. Tout commence sur la plateforme Fyctia avec son premier roman, Black Feelings, qui remporte le concours grâce à sa plume authentique. Connectée et engagée, elle souhaite créer un nouveau genre : la « Romance engagée ».",
    theatre: "Elle écrit également ses propres pièces de théâtre qui enchantent petits et grands. Responsable du club théâtre de son établissement depuis plus de dix ans, ses spectacles loufoques et modernes sont très attendus !",
    faits: [
      { chiffre: "24", libelle: "romans à découvrir" },
      { chiffre: "1er", libelle: "prix du concours Fyctia avec Black Feelings" },
      { chiffre: "10+", libelle: "ans à la tête du club théâtre de son établissement" },
      { chiffre: "2", libelle: "maisons d'édition, et l'auto-édition" }
    ],
    images: {
      logo: "commun/img/logo-mo.webp",                 // logo : boucles, lèvres rouges, cœur « Love / Liebe » (640×640)
      portraitMots: "../images/author-portrait.webp",   // portrait fait de mots (713×719, basse définition : petit format seulement)
      illustration: "commun/img/mo-illustree.webp",     // Mo qui écrit, illustration (1100×1366)
      illustrationDetouree: "commun/img/mo-illustree-detouree.webp", // la même, fond transparent (870×1090)
      avecSonRoman: "commun/img/mo-et-son-roman.webp",  // Mo souriante tenant le roman de Noël (660×825)
      enSalon: "commun/img/mo-en-salon.webp",           // photo réelle sur son stand (480×640)
      famille: "../images/visuels/fille-pere-noel-familles.webp" // Mo entourée de ses personnages (1536×1024)
    }
  },

  nouveau: {
    titre: "Elle est la fille du Père Noël & je suis le fils du Père Fouettard",
    ligne1: "Elle est la fille du Père Noël",
    ligne2: "& je suis le fils du Père Fouettard",
    genre: "Romance de Noël",
    statut: "Disponible",
    accroche: "Deux héritages. Zéro point commun.",
    pitch: "Wendy, la fille du Père Noël, rencontre Dante, le fils du Père Fouettard. Et vous, à Noël, quel camp choisirez-vous ?",
    themes: ["Amours contrariées", "Deux mondes", "Secrets de famille", "Magie de Noël", "Bal de Noël", "Univers enneigé"],
    personnages: [
      { nom: "Wendy", role: "la fille du Père Noël", camp: "Team Noëlie" },
      { nom: "Dante", role: "le fils du Père Fouettard", camp: "Team Krampen" }
    ],
    couverture: "../images/couvertures/fille-pere-noel.jpg",
    collector: "../images/couvertures/fille-pere-noel-collector.jpg",
    heros: "../images/filtre-noel/wendy-dante.webp",   // Wendy et Dante détourés, fond transparent (900×910)
    filtre: {
      titre: "Posez avec Wendy & Dante",
      texte: "Choisissez votre camp, activez votre caméra et glissez les héros à côté de vous. Votre photo de Noël est prête à partager."
    }
  },

  /* Rubriques de la page Romans */
  rubriques: [
    { id: "nouveaute", nom: "Nouveauté" },
    { id: "edition", nom: "En maison d'édition" },
    { id: "series", nom: "Séries" },
    { id: "fetes", nom: "Fêtes" },
    { id: "oneshots", nom: "One-shots" }
  ],

  /* Les 24 romans. humeurs : rire | frissons | noel | evasion | emotion */
  livres: [
    { id: "fille-pere-noel", titre: "Elle est la fille du Père Noël & je suis le fils du Père Fouettard", court: "La fille du Père Noël", genre: "Romance de Noël", rubrique: "nouveaute", humeurs: ["noel", "rire"], teinte: "#c5190f", couv: "../images/couvertures/fille-pere-noel.jpg", nouveau: true },
    { id: "black-feelings-1", titre: "Black Feelings — Saison 1", court: "Black Feelings 1", serie: "Black Feelings", genre: "Romance • Suspense", sujet: "Harcèlement", rubrique: "edition", humeurs: ["frissons", "emotion"], teinte: "#e0186f", couv: "../images/couvertures/black-feelings-tome-1.jpg" },
    { id: "black-feelings-2", titre: "Black Feelings — Saison 2", court: "Black Feelings 2", serie: "Black Feelings", genre: "Romance • Suspense", sujet: "Harcèlement", rubrique: "edition", humeurs: ["frissons", "emotion"], teinte: "#2bb5a8", couv: "../images/couvertures/black-feelings-tome-2.jpg" },
    { id: "be-sweeter", titre: "Be Sweeter", court: "Be Sweeter", serie: "Be…", genre: "New Adult • Campus", sujet: "Body positive", rubrique: "edition", humeurs: ["emotion"], teinte: "#3d7be0", couv: "../images/couvertures/be-sweeter.jpg" },
    { id: "be-stronger", titre: "Be Stronger", court: "Be Stronger", serie: "Be…", genre: "New Adult • Résilience", sujet: "Body positive", rubrique: "edition", humeurs: ["emotion"], teinte: "#4f86c6", couv: "../images/couvertures/be-stronger.jpg" },
    { id: "be-yourself", titre: "Be Yourself", court: "Be Yourself", serie: "Be…", genre: "New Adult • Identité", sujet: "Body positive", rubrique: "edition", humeurs: ["emotion"], teinte: "#c9a45c", couv: "../images/couvertures/be-yourself.jpg" },
    { id: "at", titre: "AT — The Beginning", court: "AT — The Beginning", serie: "AT", genre: "Duologie • Romance sombre", rubrique: "series", humeurs: ["frissons"], teinte: "#8b5ff1", couv: "../images/couvertures/AT_couverture.PNG" },
    { id: "cops-will", titre: "COPS and Love — Will Hunter, le bad boy", court: "COPS · Will Hunter", serie: "COPS and Love", genre: "Romantic Suspense", sujet: "Addictions", rubrique: "series", humeurs: ["frissons"], teinte: "#7a6a5f", couv: "../images/couvertures/cops-and-love-will-hunter.jpg" },
    { id: "cops-noah", titre: "COPS and Love — Noah Hunter, le bon flic", court: "COPS · Noah Hunter", serie: "COPS and Love", genre: "Romantic Suspense", sujet: "Addictions", rubrique: "series", humeurs: ["frissons"], teinte: "#4a6572", couv: "../images/couvertures/cops-noah.jpg" },
    { id: "cops-lewis", titre: "COPS and Love — Lewis Hunter, l'ange déchu", court: "COPS · Lewis Hunter", serie: "COPS and Love", genre: "Romantic Suspense", sujet: "Addictions", rubrique: "series", humeurs: ["frissons"], teinte: "#7fb6d6", couv: "../images/couvertures/cops-lewis.jpg" },
    { id: "sur-le-sable", titre: "Sur le sable", court: "Sur le sable", serie: "Les saisons", genre: "Romance d'été", rubrique: "series", humeurs: ["evasion"], teinte: "#d3ac8d", couv: "../images/couvertures/sur-le-sable.jpg" },
    { id: "dans-les-fleurs", titre: "Dans les fleurs", court: "Dans les fleurs", serie: "Les saisons", genre: "Romance de printemps", rubrique: "series", humeurs: ["evasion"], teinte: "#e58fa6", couv: "../images/couvertures/fleurs.jpg" },
    { id: "en-pleine-nature", titre: "En pleine nature", court: "En pleine nature", serie: "Les saisons", genre: "Romance d'automne", rubrique: "series", humeurs: ["evasion"], teinte: "#2f6b3a", couv: "../images/couvertures/nature.jpg" },
    { id: "dans-l-eau", titre: "Dans l'eau", court: "Dans l'eau", serie: "Les saisons", genre: "Romance d'été", rubrique: "series", humeurs: ["evasion"], teinte: "#0a82bd", couv: "../images/couvertures/dans-l-eau.jpg" },
    { id: "prends-buche", titre: "Prends de la bûche", court: "Prends de la bûche", genre: "Romance de Noël • Enemies to Lovers", rubrique: "fetes", humeurs: ["noel", "rire"], teinte: "#b3262b", couv: "../images/dernier-livre.jpg" },
    { id: "believe-santa", titre: "Believe in (Santa) Klaus", court: "Believe in (Santa) Klaus", genre: "Comédie de Noël", rubrique: "fetes", humeurs: ["noel", "rire"], teinte: "#b3202a", couv: "../images/couvertures/believe-in-santa-klaus.jpg" },
    { id: "be-mine", titre: "Be Mine For Valentine's !", court: "Be Mine For Valentine's", genre: "Romance Saint-Valentin", rubrique: "fetes", humeurs: ["rire"], teinte: "#ff8fd4", couv: "../images/couvertures/be-mine-valentine.jpg" },
    { id: "poupee-bimbo", titre: "Homme sérieux recherche poupée Bimbo pour Noël", court: "Poupée Bimbo", genre: "Comédie romantique", sujet: "Préjugés", rubrique: "fetes", humeurs: ["noel", "rire"], teinte: "#e83e8c", couv: "../images/couvertures/poupee-bimbo.jpg" },
    { id: "princesse-licorne", titre: "À Noël, je serai une princesse licorne !", court: "Princesse licorne", genre: "Comédie déjantée", sujet: "Poids des traditions", rubrique: "fetes", humeurs: ["noel", "rire"], teinte: "#d6453d", couv: "../images/couvertures/princesse-licorne.jpg" },
    { id: "noel-coups-bas", titre: "Noël, coups bas et Secret Santa", court: "Noël, coups bas et Secret Santa", genre: "Enemies to Lovers", rubrique: "fetes", humeurs: ["noel", "rire"], teinte: "#c9a36b", couv: "../images/couvertures/noel-coups-bas.jpg" },
    { id: "babysitter", titre: "My Sweet Babysitter", court: "My Sweet Babysitter", genre: "Romance maman solo", rubrique: "oneshots", humeurs: ["emotion", "rire"], teinte: "#6fb5c0", couv: "../images/couvertures/my-sweet-babysitter.jpg" },
    { id: "jai-juste-clique", titre: "J'ai juste cliqué !", court: "J'ai juste cliqué !", genre: "Romance 2.0", sujet: "Rencontres virtuelles", rubrique: "oneshots", humeurs: ["emotion"], teinte: "#b5764a", couv: "../images/couvertures/j-ai-juste-clique.jpg" },
    { id: "et-zut", titre: "Et zut !", court: "Et zut !", genre: "Romance gourmande", rubrique: "oneshots", humeurs: ["rire"], teinte: "#d6336c", couv: "../images/couvertures/et-zut.jpg" },
    { id: "undress-me", titre: "Undress Me", court: "Undress Me", genre: "Romance sexy", sujet: "Traumatismes de l'enfance", rubrique: "oneshots", humeurs: ["frissons", "emotion"], teinte: "#ff4fa3", couv: "../images/couvertures/undress-me.jpg" }
  ],

  /* Séries (pour les présentations « par série ») */
  series: [
    { nom: "COPS and Love", detail: "3 tomes · Romantic Suspense", ids: ["cops-will", "cops-noah", "cops-lewis"] },
    { nom: "Be…", detail: "3 tomes · New Adult", ids: ["be-sweeter", "be-stronger", "be-yourself"] },
    { nom: "Black Feelings", detail: "2 saisons · Romance & suspense", ids: ["black-feelings-1", "black-feelings-2"] },
    { nom: "Les saisons", detail: "4 romans · une saison, une histoire", ids: ["dans-les-fleurs", "sur-le-sable", "en-pleine-nature", "dans-l-eau"] },
    { nom: "Les Noëls de Mo", detail: "6 romances de fêtes", ids: ["fille-pere-noel", "prends-buche", "believe-santa", "poupee-bimbo", "princesse-licorne", "noel-coups-bas"] }
  ],

  /* La « Romance engagée » : un sujet de société derrière chaque histoire (source : page L'Auteure) */
  sujets: [
    { sujet: "Harcèlement", detail: "Que feriez-vous si vous recroisiez le bourreau de votre adolescence ?", roman: "Black Feelings", ids: ["black-feelings-1", "black-feelings-2"] },
    { sujet: "Addictions", detail: "Les ravages des addictions, au cœur d'une fratrie.", roman: "COPS and Love", ids: ["cops-lewis", "cops-will", "cops-noah"] },
    { sujet: "Body positive", detail: "S'aimer d'abord : trois héroïnes, trois reconstructions.", roman: "Be Sweeter · Be Stronger · Be Yourself", ids: ["be-sweeter", "be-stronger", "be-yourself"] },
    { sujet: "Rencontres virtuelles", detail: "Les dangers des rencontres derrière un écran.", roman: "J'ai juste cliqué !", ids: ["jai-juste-clique"] },
    { sujet: "Préjugés", detail: "Les préjugés et le mensonge, version comédie de Noël.", roman: "Homme sérieux recherche poupée Bimbo pour Noël", ids: ["poupee-bimbo"] },
    { sujet: "Poids des traditions", detail: "La pression des traditions familiales.", roman: "À Noël, je serai une princesse licorne !", ids: ["princesse-licorne"] },
    { sujet: "Traumatismes", detail: "Traumatismes de l'enfance et fanatisme religieux.", roman: "Undress Me", ids: ["undress-me"] }
  ],

  /* Envies de lecture (pour les présentations « par humeur ») */
  humeurs: [
    { id: "rire", nom: "Envie de rire", emoji: "😄" },
    { id: "frissons", nom: "Envie de frissons", emoji: "🔥" },
    { id: "noel", nom: "Envie de Noël", emoji: "🎄" },
    { id: "evasion", nom: "Envie d'évasion", emoji: "🌴" },
    { id: "emotion", nom: "Envie d'émotions", emoji: "💗" }
  ],

  /* Bandes-annonces existantes */
  bandesAnnonces: [
    { titre: "Prends de la bûche", duree: "0:31", affiche: "../images/prends-buche-art.webp", video: "../assets/Trailer.mp4" },
    { titre: "Black Feelings — Saison 1", duree: "0:06", affiche: "../images/blog/BF_reedition_web.jpg", video: "../assets/blackF1.mp4" },
    { titre: "Black Feelings — Saison 2", duree: "1:17", affiche: "../images/couvertures/black-feelings-tome-2.jpg", video: "../assets/blackF2.mp4" }
  ],

  /* Les 3 dernières actualités du blog */
  actus: [
    { date: "14 novembre 2026", jour: "14", mois: "nov.", titre: "Elle est la fille du Père Noël & je suis le fils du Père Fouettard", resume: "À Noël, quel camp choisirez-vous ?", rubrique: "Nouveauté", image: "../images/visuels/fille-pere-noel-familles.webp" },
    { date: "25 mars 2026", jour: "25", mois: "mars", titre: "Arte et moi : une apparition (presque) involontaire", resume: "Le jour où ma sœur et moi avons failli devenir des icônes télévisuelles sur Arte.", rubrique: "Coulisses", image: "../posts/images/blog/032526/mo_devant_tv.jpg" },
    { date: "20 mars 2026", jour: "20", mois: "mars", titre: "Je dédicace à l'étranger !", resume: "L'un de mes vieux rêves vient de se réaliser : rencontrer mes lecteurs belges au Salon Love Story à Mons.", rubrique: "Salon", image: "../posts/images/blog/im2_converted.webp" }
  ],

  lettre: {
    titre: "Rejoignez le Cercle des Intimes",
    texte: "Soyez les premiers informés des nouvelles sorties et du contenu exclusif.",
    bouton: "S'abonner"
  },

  menu: ["Accueil", "Dernier roman", "Romans", "L'Auteure", "Blog", "Contact"],

  /* Petits outils */
  livre: function (id) { return this.livres.find(function (l) { return l.id === id; }); },
  parRubrique: function (id) { return this.livres.filter(function (l) { return l.rubrique === id; }); },
  parHumeur: function (id) { return this.livres.filter(function (l) { return l.humeurs.indexOf(id) >= 0; }); }
};
