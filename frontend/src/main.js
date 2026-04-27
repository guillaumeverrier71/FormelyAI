import "./style.css";
import { inject } from "@vercel/analytics";

const API_BASE = "";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let currentUser = null;
let currentSessionId = null;
let currentSession = null;
let authTab = "login"; // "login" | "register"
let _lastSessions = [];

const AUTH_ERROR = "AUTH_401"; // sentinel for unauthenticated errors

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────
let lang = localStorage.getItem("lang") || "en";

const TRANSLATIONS = {
  fr: {
    "nav.subtitle": "· Transforme tes cours en fiches intelligentes",
    "nav.library": "Bibliothèque",
    "nav.new": "Nouveau",
    "nav.premium": "Premium",
    "nav.login": "Se connecter",
    "nav.register": "S'inscrire",
    "sidebar.history": "Historique",
    "session.empty": "Aucune session",
    "upload.title": "Génère tes fiches en 1 clic",
    "upload.subtitle": "Dépose ton cours, l'IA s'occupe du reste.",
    "upload.subject": "Matière",
    "upload.subject.placeholder": "ex. Thermodynamique, Histoire, Droit…",
    "subject.placeholder": "— Choisir une matière —",
    "subject.maths": "Mathématiques",
    "subject.physics": "Physique",
    "subject.chemistry": "Chimie",
    "subject.svt": "SVT",
    "subject.si": "Sciences de l'Ingénieur (SI)",
    "subject.history": "Histoire-Géographie",
    "subject.philosophy": "Philosophie",
    "subject.french": "Français",
    "subject.english": "Anglais",
    "subject.spanish": "Espagnol",
    "subject.ses": "Économie-Sociologie (SES)",
    "subject.nsi": "Informatique (NSI)",
    "subject.law": "Droit",
    "subject.medicine": "Médecine / Santé",
    "subject.other": "Autre",
    "subject.custom.placeholder": "Précise la matière…",
    "upload.drop": "Glisse ton PDF ici",
    "upload.drop.or": "ou clique pour sélectionner",
    "upload.drop.free_hint": "Gratuit : 10 premières pages · 10 fiches max",
    "upload.or": "ou",
    "upload.text": "Colle ton texte",
    "upload.text.placeholder": "Colle ici le contenu de ton cours…",
    "upload.btn": "Générer les fiches avec l'IA",
    "upload.manual": "Créer manuellement (gratuit)",
    "loading.title": "Analyse en cours…",
    "loading.msg": "L'IA lit ton cours et génère les fiches.",
    "loading.wait": "Ça peut prendre 30 à 60 secondes, ne ferme pas l'onglet.",
    "loading.session": "Chargement de la session…",
    "loading.anim": "Chargement…",
    "results.practice": "Practice",
    "results.card": "Carte",
    "results.share": "Partager",
    "results.shared": "Partagé",
    "results.new": "Nouveau",
    "results.tab.qa": "Q / R",
    "results.tab.summaries": "Résumés",
    "results.anki.title": "Export Anki (.apkg) — Premium",
    "results.pdf.title": "Export PDF — Premium",
    "stats.questions": "Questions",
    "stats.review": "À réviser",
    "stats.summaries": "Résumés",
    "stats.revisions": "Révisions",
    "card.click": "Clique pour voir la réponse",
    "card.reviewed": "Révisé",
    "card.due": "À réviser",
    "card.days": "j",
    "practice.title": "Mode Practice",
    "practice.quit": "Quitter",
    "practice.restart": "Recommencer",
    "practice.back": "Retour aux fiches",
    "practice.end": "Session terminée !",
    "practice.see": "Voir la réponse",
    "practice.question": "Question",
    "practice.answer": "Réponse",
    "practice.knew": "Je savais !",
    "practice.didnt": "Je ne savais pas",
    "practice.again": "À revoir",
    "practice.hard": "Difficile",
    "practice.good": "Bien",
    "practice.easy": "Facile",
    "practice.next": (n) => n === 1 ? "demain" : `${n}j`,
    "practice.remaining": "restante",
    "practice.remainings": "restantes",
    "practice.progress": (done, total, remaining) =>
      `${done} / ${total} · ${remaining} restante${remaining > 1 ? "s" : ""}`,
    "practice.end.stats": (correct, total, pct) =>
      `${correct} sur ${total} cartes réussies — ${pct}% de réussite`,
    "practice.cards": (total) => `${total} / ${total} cartes`,
    "library.title": "Bibliothèque Premium",
    "library.subtitle": "Fiches partagées par la communauté",
    "library.copy": "Copier dans mon compte",
    "library.loading": "Chargement…",
    "library.empty": "Aucun deck partagé pour l'instant.",
    "library.error": "Erreur de chargement.",
    "library.by": "par",
    "library.qa": "Q/R",
    "library.summaries": "fiches",
    "manual.title": "Création manuelle",
    "manual.subtitle": "Crée un deck sans IA, 100% gratuit",
    "manual.deck.title": "Titre du deck",
    "manual.deck.placeholder": "ex. Chapitre 3 — Thermodynamique",
    "manual.subject.placeholder": "ex. Physique",
    "manual.create": "Créer le deck",
    "auth.subtitle": "Fiches intelligentes pour tes cours",
    "auth.login": "Se connecter",
    "auth.register": "S'inscrire",
    "auth.email": "Email",
    "auth.password": "Mot de passe",
    "auth.password.hint": "Minimum 6 caractères",
    "auth.submit.login": "Se connecter",
    "auth.submit.register": "Créer mon compte",
    "auth.no.account": "Pas encore de compte ?",
    "auth.has.account": "Déjà un compte ?",
    "auth.loading": "Chargement…",
    "qa.add": "Ajouter une carte",
    "qa.edit": "Modifier la carte",
    "qa.question": "Question",
    "qa.answer": "Réponse",
    "qa.question.placeholder": "Ta question…",
    "qa.answer.placeholder": "La réponse…",
    "qa.save": "Sauvegarder",
    "modal.cancel": "Annuler",
    "modal.delete": "Supprimer",
    "paywall.premium.label": "Inclus dans Premium",
    "paywall.f1": "20 uploads PDF par mois",
    "paywall.f2": "Révision intelligente (spaced repetition)",
    "paywall.f3": "Export Anki (.apkg)",
    "paywall.f4": "Export PDF",
    "paywall.f5": "Suivi de progression",
    "paywall.month": "/mois",
    "paywall.subscribe": "S'abonner maintenant",
    "paywall.manage": "Gérer mon abonnement",
    "paywall.credits": "Acheter 3 générations IA pour 1 €",
    "paywall.f1.title": "20 PDFs analysés par mois",
    "paywall.f1.desc": "Tous tes cours convertis en fiches, sans restriction.",
    "paywall.f2.title": "Révision espacée (algorithme SM-2)",
    "paywall.f2.desc": "Les cartes reviennent au bon moment — mémorise en moins de temps.",
    "paywall.f5.title": "Suivi de progression détaillé",
    "paywall.f5.desc": "XP, niveaux, badges et courbes de révision pour rester motivé.",
    "paywall.f3.title": "Export Anki & PDF",
    "paywall.f3.desc": "Emporte tes fiches partout, sur toutes tes applis préférées.",
    "paywall.price.label": "Abonnement mensuel",
    "paywall.price.cancel": "Sans engagement",
    "paywall.price.coffee": "= 1 café / mois",
    "paywall.secure": "Paiement sécurisé par Stripe · Annulation en 1 clic",
    "paywall.title.upgrade": "Passe à Premium",
    "paywall.subtitle.upgrade": "Tu as atteint la limite du plan gratuit (1 PDF).",
    "paywall.title.quota": "Quota mensuel atteint",
    "paywall.subtitle.quota": "Tu as utilisé tous tes PDF ce mois-ci. Achète des crédits ou attends le prochain mois.",
    "paywall.title.premium": "Fonctionnalité Premium",
    "paywall.subtitle.premium": "Cette fonctionnalité est réservée aux abonnés Premium.",
    "usage.upgrade": "Passer Premium",
    "usage.month": "ce mois-ci",
    "usage.total": "au total",
    "usage.pdf": (used, limit) => `${used} / ${limit} PDF utilisé${used > 1 ? "s" : ""}`,
    "confirm.session.title": "Supprimer cette session ?",
    "confirm.session.msg": "Toutes les cartes et résumés seront perdus.",
    "confirm.card.title": "Supprimer cette carte ?",
    "confirm.irrev": "Cette action est irréversible.",
    "toast.pdf.only": "Seuls les fichiers PDF sont acceptés.",
    "toast.no.content": "Dépose un PDF ou colle du texte.",
    "toast.welcome": "Bienvenue !",
    "toast.registered": "Compte créé ! Bienvenue 🎉",
    "toast.logout": "Déconnecté.",
    "toast.reviewed": "Carte marquée comme révisée !",
    "toast.deleted.session": "Session supprimée.",
    "toast.shared": "Deck partagé dans la bibliothèque !",
    "toast.unshared": "Deck retiré de la bibliothèque.",
    "toast.added": "Carte ajoutée !",
    "toast.edited": "Carte modifiée !",
    "toast.deleted.card": "Carte supprimée.",
    "toast.deck.created": "Deck créé ! Ajoute tes cartes.",
    "toast.stripe.error": "Erreur Stripe.",
    "toast.credits.added": "3 crédits ajoutés à ton compte !",
    "toast.premium": "Abonnement Premium activé ! Merci 🎉",
    "toast.no.session": "Ouvre d'abord une session.",
    "toast.no.cards": "Aucune carte disponible.",
    "toast.no.title": "Entre un titre.",
    "toast.fill.qa": "Remplis la question et la réponse.",
    "toast.network": "Erreur réseau. Réessaie.",
    "toast.no.auth": "Non authentifié",
    "auth.or": "ou",
    "auth.google": "Continuer avec Google",
    "toast.google.error": "Connexion Google échouée.",
    "auth.forgot": "Mot de passe oublié ?",
    "forgot.title": "Mot de passe oublié",
    "forgot.subtitle": "Entre ton email, on t'envoie un lien.",
    "forgot.send": "Envoyer le lien",
    "forgot.sent": "Vérifie ta boîte mail !",
    "forgot.sending": "Envoi…",
    "reset.title": "Nouveau mot de passe",
    "reset.placeholder": "Nouveau mot de passe (min. 6 car.)",
    "reset.submit": "Enregistrer",
    "reset.saving": "Enregistrement…",
    "reset.success": "Mot de passe mis à jour ! Connecte-toi.",
    "toast.pdf.large": (mb) => `PDF trop volumineux (max ${mb} Mo).`,
    "legal.mentions": "Mentions légales",
    "legal.cgu": "CGU",
    "legal.privacy": "Politique de confidentialité",
    "legal.contact": "Contact",
    "contact.title": "Nous contacter",
    "contact.subtitle": "Une question ? Un bug ? On répond rapidement.",
    "contact.delay": "Réponse sous 24-48h",
    "error.session": "Session introuvable",
    "error.add": "Erreur lors de l'ajout.",
    "error.edit": "Erreur lors de la modification.",
    "error.delete": "Erreur lors de la suppression.",
    "date.locale": "fr-FR",
    "session.qa": "Q/R",
    "session.summaries": "fiches",
    "nav.practice": "Practice",
    "nav.dashboard": "Stats",
    "dashboard.title": "Progression",
    "dashboard.subtitle": "Tes statistiques d'apprentissage",
    "dashboard.premium_msg": "Courbes disponibles avec Premium",
    "dashboard.chart.reviews": "Révisions par jour (30j)",
    "dashboard.chart.xp": "XP cumulé",
    "dashboard.subjects": "Répartition par matière",
    "dashboard.due": "Cartes à réviser par deck",
    "dashboard.kpi.cards": "Cartes",
    "dashboard.kpi.decks": "Decks",
    "dashboard.kpi.reviews": "Révisions",
    "dashboard.kpi.due": "À réviser",
    "dashboard.no_data": "Pas encore de données.",
    "results.export": "Exporter",
    "practiceselect.title": "Choisir les decks à réviser",
    "practiceselect.subtitle": "Sélectionne les matières ou chapitres à mélanger",
    "practiceselect.due_only": "Uniquement les cartes à réviser",
    "practiceselect.start": "Lancer la session",
    "practiceselect.all": "Tout sélectionner",
    "practiceselect.none": "Désélectionner",
    "practiceselect.empty": "Aucun deck disponible.",
    "practiceselect.no_selection": "Sélectionne au moins un deck.",
    "practiceselect.cards": (n) => `${n} carte${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`,
    "practiceselect.due": "à réviser",
    "nav.logout": "Se déconnecter",
    "upload.free.limit": "Plan gratuit · 10 pages analysées · 10 fiches max",
    "upload.free.upgrade": "Passer Premium",
    "results.anon.save": "Crée un compte gratuit pour sauvegarder ces fiches et les réviser plus tard.",
    "results.free.limit.pages": (ext, tot) => `Plan gratuit : seulement les ${ext} premières pages sur ${tot} ont été analysées.`,
    "results.free.limit.qa": (n) => `Plan gratuit : ${n} fiches générées (max 10). Passe à Premium pour en obtenir davantage.`,
    "results.free.limit.both": (ext, tot, n) => `Plan gratuit : ${ext}/${tot} pages analysées · ${n} fiches générées (max 10). Passe à Premium pour lever ces limites.`,
    "practice.prev": "Carte précédente",
    "practice.smart": "Intelligent",
    "practice.smart.again": "Revu dans quelques minutes",
    "practice.smart.tomorrow": "Revu demain",
    "practice.smart.days": (n) => `Revu dans ${n} jour${n > 1 ? "s" : ""}`,
    "practiceselect.smart": "Mode Intelligent",
    "landing.badge": "100% gratuit pour commencer",
    "landing.h1": "Transforme tes cours en <span class=\"text-violet-500\">fiches intelligentes</span> en 30s",
    "landing.sub": "Upload ton PDF, l'IA génère tes questions/réponses et résumés. Révise avec un algorithme adaptatif qui t'aide à retenir pour de bon.",
    "landing.cta": "Commencer gratuitement",
    "landing.how": "Comment ça marche",
    "landing.proof1": "Rejoins les étudiants qui révisent plus vite",
    "landing.proof2": "Des milliers de fiches déjà générées",
    "landing.proof3": "Aucune carte bancaire requise",
    "landing.hiw.title": "Comment ça marche",
    "landing.hiw.sub": "3 étapes, 30 secondes",
    "landing.step1.label": "Étape 1",
    "landing.step1.title": "Upload ton cours",
    "landing.step1.desc": "Glisse ton PDF ou colle directement ton texte. Toutes les matières sont supportées.",
    "landing.step2.label": "Étape 2",
    "landing.step2.title": "L'IA génère tes fiches",
    "landing.step2.desc": "Questions/réponses et résumés structurés générés automatiquement en 30 secondes.",
    "landing.step3.label": "Étape 3",
    "landing.step3.title": "Révise et progresse",
    "landing.step3.desc": "Le système adapte tes révisions selon tes résultats. Retiens 3× plus longtemps.",
    "landing.features.title": "Tout ce dont tu as besoin pour réviser",
    "landing.feat1.title": "Révision intelligente (Spaced Repetition)",
    "landing.feat1.desc": "Basé sur l'algorithme SM-2 utilisé par Anki — le système calcule le moment optimal pour te présenter chaque carte. Tu révises moins mais retiens beaucoup plus longtemps.",
    "landing.feat2.title": "Export Anki & PDF",
    "landing.feat2.desc": "Exporte tes fiches en format .apkg pour Anki, en PDF pour imprimer, ou en CSV pour les réutiliser dans d'autres outils.",
    "landing.feat3.title": "Gamification & progression",
    "landing.feat3.desc": "Gagne de l'XP, monte de niveau et débloque des badges à chaque session. Le dashboard suit ta progression par matière.",
    "landing.feat4.title": "Bibliothèque communautaire",
    "landing.feat4.desc": "Partage tes decks avec la communauté ou copie des fiches déjà créées par d'autres étudiants sur les mêmes matières.",
    "landing.free.title": "🎁 Qu'est-ce qui est gratuit ?",
    "landing.free.sub": "Pas besoin de carte bancaire pour commencer.",
    "landing.free.gen": "génération IA gratuite<br/><span class=\"text-xs font-normal text-slate-400\">(10 pages · 10 fiches)</span>",
    "landing.free.decks": "decks manuels<br/>sans limite",
    "landing.free.practice": "révisions &<br/>Practice",
    "landing.free.premium": "Premium : 20 générations/mois · Export Anki & PDF · Stats avancées — <strong>3,99€/mois</strong>",
    "landing.faq.title": "Questions fréquentes",
    "landing.card.label.question": "Question",
    "landing.card.question": "Qu'est-ce que la photosynthèse ?",
    "landing.card.label.answer": "Réponse",
    "landing.card.answer": "Processus par lequel les plantes convertissent la lumière en énergie chimique via la chlorophylle…",
    "landing.card.label.summary": "Résumé",
    "landing.card.summary": "La photosynthèse est la réaction 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂, catalysée par la chlorophylle…",
    "landing.faq.q1": "La qualité des fiches est-elle bonne ?",
    "landing.faq.a1": "Oui — FormelyAI utilise la meilleure IA générative du marché pour analyser ton cours et générer des questions pertinentes, pas juste du copié-collé. Les résumés sont structurés et les questions ciblent les notions clés. Tu peux toujours modifier ou supprimer les cartes générées.",
    "landing.faq.q2": "Quelles langues sont supportées ?",
    "landing.faq.a2": "FormelyAI supporte le français et l'anglais nativement. L'IA comprend et génère des fiches dans la langue de ton cours — si tu uploades un PDF en espagnol, les fiches seront en espagnol.",
    "landing.faq.q3": "Comment marche la révision intelligente ?",
    "landing.faq.a3": "On utilise l'algorithme SM-2 (le même qu'Anki). Après chaque révision, tu indiques si tu savais la réponse ou non. Le système calcule automatiquement dans combien de jours te représenter la carte — plus tu la sais, plus l'intervalle grandit.",
    "landing.faq.q4": "Puis-je exporter vers Anki ?",
    "landing.faq.a4": "Oui, avec le plan Premium. Tu peux exporter n'importe quel deck en fichier .apkg compatible avec Anki desktop et mobile. Tu peux aussi exporter en PDF ou CSV.",
    "landing.faq.q5": "Mes données sont-elles sécurisées ?",
    "landing.faq.a5": "Tes PDFs ne sont pas stockés sur nos serveurs — uniquement les fiches générées. Toutes les données sont chiffrées en transit (HTTPS) et hébergées en Europe. Tu peux supprimer ton compte et toutes tes données à tout moment.",
    "landing.cta.try": "✦ Essaie maintenant — c'est gratuit",
    "due.start": "Réviser maintenant",
    "due.widget": (n) => `${n} carte${n > 1 ? "s" : ""} à réviser aujourd'hui`,
    "due.session": (n) => `${n} à réviser`,
  },
  en: {
    "nav.subtitle": "· Transform your courses into smart flashcards",
    "nav.library": "Library",
    "nav.new": "New",
    "nav.premium": "Premium",
    "nav.login": "Log in",
    "nav.register": "Sign up",
    "sidebar.history": "History",
    "session.empty": "No sessions",
    "upload.title": "Generate your flashcards in 1 click",
    "upload.subtitle": "Drop your course, the AI does the rest.",
    "upload.subject": "Subject",
    "upload.subject.placeholder": "e.g. Thermodynamics, History, Law…",
    "subject.placeholder": "— Choose a subject —",
    "subject.maths": "Mathematics",
    "subject.physics": "Physics",
    "subject.chemistry": "Chemistry",
    "subject.svt": "Biology",
    "subject.si": "Engineering Sciences",
    "subject.history": "History & Geography",
    "subject.philosophy": "Philosophy",
    "subject.french": "French",
    "subject.english": "English",
    "subject.spanish": "Spanish",
    "subject.ses": "Economics",
    "subject.nsi": "Computer Science",
    "subject.law": "Law",
    "subject.medicine": "Medicine / Health",
    "subject.other": "Other",
    "subject.custom.placeholder": "Specify the subject…",
    "upload.drop": "Drop your PDF here",
    "upload.drop.or": "or click to select",
    "upload.drop.free_hint": "Free: first 10 pages · 10 flashcards max",
    "upload.or": "or",
    "upload.text": "Paste your text",
    "upload.text.placeholder": "Paste your course content here…",
    "upload.btn": "Generate flashcards with AI",
    "upload.manual": "Create manually (free)",
    "loading.title": "Analysis in progress…",
    "loading.msg": "The AI is reading your course and generating flashcards.",
    "loading.wait": "This may take 30 to 60 seconds, don't close the tab.",
    "loading.session": "Loading session…",
    "loading.anim": "Loading…",
    "results.practice": "Practice",
    "results.card": "Card",
    "results.share": "Share",
    "results.shared": "Shared",
    "results.new": "New",
    "results.tab.qa": "Q / A",
    "results.tab.summaries": "Summaries",
    "results.anki.title": "Export Anki (.apkg) — Premium",
    "results.pdf.title": "Export PDF — Premium",
    "stats.questions": "Questions",
    "stats.review": "To review",
    "stats.summaries": "Summaries",
    "stats.revisions": "Reviews",
    "card.click": "Click to see the answer",
    "card.reviewed": "Reviewed",
    "card.due": "To review",
    "card.days": "d",
    "practice.title": "Practice Mode",
    "practice.quit": "Quit",
    "practice.restart": "Restart",
    "practice.back": "Back to cards",
    "practice.end": "Session complete!",
    "practice.see": "See the answer",
    "practice.question": "Question",
    "practice.answer": "Answer",
    "practice.knew": "I knew it!",
    "practice.didnt": "I didn't know",
    "practice.again": "Again",
    "practice.hard": "Hard",
    "practice.good": "Good",
    "practice.easy": "Easy",
    "practice.next": (n) => n === 1 ? "tomorrow" : `${n}d`,
    "practice.remaining": "remaining",
    "practice.remainings": "remaining",
    "practice.progress": (done, total, remaining) =>
      `${done} / ${total} · ${remaining} remaining`,
    "practice.end.stats": (correct, total, pct) =>
      `${correct} out of ${total} cards correct — ${pct}% success rate`,
    "practice.cards": (total) => `${total} / ${total} cards`,
    "library.title": "Premium Library",
    "library.subtitle": "Flashcards shared by the community",
    "library.copy": "Copy to my account",
    "library.loading": "Loading…",
    "library.empty": "No shared decks yet.",
    "library.error": "Loading error.",
    "library.by": "by",
    "library.qa": "Q/A",
    "library.summaries": "summaries",
    "manual.title": "Manual Creation",
    "manual.subtitle": "Create a deck without AI, 100% free",
    "manual.deck.title": "Deck title",
    "manual.deck.placeholder": "e.g. Chapter 3 — Thermodynamics",
    "manual.subject.placeholder": "e.g. Physics",
    "manual.create": "Create deck",
    "auth.subtitle": "Smart flashcards for your courses",
    "auth.login": "Log in",
    "auth.register": "Sign up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.password.hint": "Minimum 6 characters",
    "auth.submit.login": "Log in",
    "auth.submit.register": "Create my account",
    "auth.no.account": "No account yet?",
    "auth.has.account": "Already have an account?",
    "auth.loading": "Loading…",
    "qa.add": "Add a card",
    "qa.edit": "Edit card",
    "qa.question": "Question",
    "qa.answer": "Answer",
    "qa.question.placeholder": "Your question…",
    "qa.answer.placeholder": "The answer…",
    "qa.save": "Save",
    "modal.cancel": "Cancel",
    "modal.delete": "Delete",
    "paywall.premium.label": "Included in Premium",
    "paywall.f1": "20 PDF uploads per month",
    "paywall.f2": "Smart review (spaced repetition)",
    "paywall.f3": "Anki export (.apkg)",
    "paywall.f4": "PDF export",
    "paywall.f5": "Progress tracking",
    "paywall.month": "/month",
    "paywall.subscribe": "Subscribe now",
    "paywall.manage": "Manage my subscription",
    "paywall.credits": "Buy 3 AI generations for €1",
    "paywall.f1.title": "20 PDFs analyzed per month",
    "paywall.f1.desc": "All your courses turned into flashcards, no restrictions.",
    "paywall.f2.title": "Spaced repetition (SM-2 algorithm)",
    "paywall.f2.desc": "Cards come back at the right time — memorize in less time.",
    "paywall.f5.title": "Detailed progress tracking",
    "paywall.f5.desc": "XP, levels, badges and review charts to stay motivated.",
    "paywall.f3.title": "Anki & PDF export",
    "paywall.f3.desc": "Take your flashcards everywhere, on all your favorite apps.",
    "paywall.price.label": "Monthly subscription",
    "paywall.price.cancel": "No commitment",
    "paywall.price.coffee": "= 1 coffee / month",
    "paywall.secure": "Secured by Stripe · Cancel anytime",
    "paywall.title.upgrade": "Go Premium",
    "paywall.subtitle.upgrade": "You've reached the free plan limit (1 PDF).",
    "paywall.title.quota": "Monthly quota reached",
    "paywall.subtitle.quota": "You've used all your PDFs this month. Buy credits or wait until next month.",
    "paywall.title.premium": "Premium Feature",
    "paywall.subtitle.premium": "This feature is reserved for Premium subscribers.",
    "usage.upgrade": "Go Premium",
    "usage.month": "this month",
    "usage.total": "total",
    "usage.pdf": (used, limit) => `${used} / ${limit} PDF${used > 1 ? "s" : ""} used`,
    "confirm.session.title": "Delete this session?",
    "confirm.session.msg": "All cards and summaries will be lost.",
    "confirm.card.title": "Delete this card?",
    "confirm.irrev": "This action cannot be undone.",
    "toast.pdf.only": "Only PDF files are accepted.",
    "toast.no.content": "Drop a PDF or paste text.",
    "toast.welcome": "Welcome!",
    "toast.registered": "Account created! Welcome 🎉",
    "toast.logout": "Logged out.",
    "toast.reviewed": "Card marked as reviewed!",
    "toast.deleted.session": "Session deleted.",
    "toast.shared": "Deck shared in the library!",
    "toast.unshared": "Deck removed from the library.",
    "toast.added": "Card added!",
    "toast.edited": "Card edited!",
    "toast.deleted.card": "Card deleted.",
    "toast.deck.created": "Deck created! Add your cards.",
    "toast.stripe.error": "Stripe error.",
    "toast.credits.added": "3 credits added to your account!",
    "toast.premium": "Premium subscription activated! Thank you 🎉",
    "toast.no.session": "Open a session first.",
    "toast.no.cards": "No cards available.",
    "toast.no.title": "Enter a title.",
    "toast.fill.qa": "Fill in the question and answer.",
    "toast.network": "Network error. Please try again.",
    "toast.no.auth": "Not authenticated",
    "auth.or": "or",
    "auth.google": "Continue with Google",
    "toast.google.error": "Google sign-in failed.",
    "auth.forgot": "Forgot password?",
    "forgot.title": "Forgot password",
    "forgot.subtitle": "Enter your email, we'll send you a link.",
    "forgot.send": "Send link",
    "forgot.sent": "Check your inbox!",
    "forgot.sending": "Sending…",
    "reset.title": "New password",
    "reset.placeholder": "New password (min. 6 chars.)",
    "reset.submit": "Save",
    "reset.saving": "Saving…",
    "reset.success": "Password updated! You can now log in.",
    "toast.pdf.large": (mb) => `PDF too large (max ${mb} MB).`,
    "legal.mentions": "Legal notice",
    "legal.cgu": "Terms of Service",
    "legal.privacy": "Privacy Policy",
    "legal.contact": "Contact",
    "contact.title": "Contact us",
    "contact.subtitle": "A question? A bug? We respond quickly.",
    "contact.delay": "Response within 24-48h",
    "error.session": "Session not found",
    "error.add": "Error while adding.",
    "error.edit": "Error while editing.",
    "error.delete": "Error while deleting.",
    "date.locale": "en-US",
    "session.qa": "Q/A",
    "session.summaries": "cards",
    "nav.practice": "Practice",
    "nav.dashboard": "Stats",
    "dashboard.title": "Progress",
    "dashboard.subtitle": "Your learning statistics",
    "dashboard.premium_msg": "Charts available with Premium",
    "dashboard.chart.reviews": "Reviews per day (30d)",
    "dashboard.chart.xp": "Cumulative XP",
    "dashboard.subjects": "Breakdown by subject",
    "dashboard.due": "Due cards by deck",
    "dashboard.kpi.cards": "Cards",
    "dashboard.kpi.decks": "Decks",
    "dashboard.kpi.reviews": "Reviews",
    "dashboard.kpi.due": "Due",
    "dashboard.no_data": "No data yet.",
    "results.export": "Export",
    "practiceselect.title": "Choose decks to practice",
    "practiceselect.subtitle": "Select subjects or chapters to mix together",
    "practiceselect.due_only": "Due cards only",
    "practiceselect.start": "Start session",
    "practiceselect.all": "Select all",
    "practiceselect.none": "Deselect all",
    "practiceselect.empty": "No decks available.",
    "practiceselect.no_selection": "Select at least one deck.",
    "practiceselect.cards": (n) => `${n} card${n > 1 ? "s" : ""} selected`,
    "practiceselect.due": "due",
    "nav.logout": "Log out",
    "upload.free.limit": "Free plan · 10 pages analyzed · 10 flashcards max",
    "upload.free.upgrade": "Go Premium",
    "results.anon.save": "Create a free account to save these flashcards and review them later.",
    "results.free.limit.pages": (ext, tot) => `Free plan: only the first ${ext} pages out of ${tot} were analyzed.`,
    "results.free.limit.qa": (n) => `Free plan: ${n} flashcards generated (max 10). Go Premium for more.`,
    "results.free.limit.both": (ext, tot, n) => `Free plan: ${ext}/${tot} pages analyzed · ${n} flashcards generated (max 10). Go Premium to remove these limits.`,
    "practice.prev": "Previous card",
    "practice.smart": "Smart",
    "practice.smart.again": "Back in a few minutes",
    "practice.smart.tomorrow": "Back tomorrow",
    "practice.smart.days": (n) => `Back in ${n} day${n > 1 ? "s" : ""}`,
    "practiceselect.smart": "Smart Mode",
    "landing.badge": "100% free to start",
    "landing.h1": "Turn your courses into <span class=\"text-violet-500\">smart flashcards</span> in 30s",
    "landing.sub": "Upload your PDF, the AI generates your Q&A and summaries. Review with an adaptive algorithm that helps you retain knowledge for good.",
    "landing.cta": "Start for free",
    "landing.how": "How it works",
    "landing.proof1": "Join students who study smarter",
    "landing.proof2": "Thousands of flashcards already generated",
    "landing.proof3": "No credit card required",
    "landing.hiw.title": "How it works",
    "landing.hiw.sub": "3 steps, 30 seconds",
    "landing.step1.label": "Step 1",
    "landing.step1.title": "Upload your course",
    "landing.step1.desc": "Drop your PDF or paste your text directly. All subjects are supported.",
    "landing.step2.label": "Step 2",
    "landing.step2.title": "AI generates your flashcards",
    "landing.step2.desc": "Q&A and structured summaries generated automatically in 30 seconds.",
    "landing.step3.label": "Step 3",
    "landing.step3.title": "Review and progress",
    "landing.step3.desc": "The system adapts your reviews based on your results. Retain 3× longer.",
    "landing.features.title": "Everything you need to study",
    "landing.feat1.title": "Smart Review (Spaced Repetition)",
    "landing.feat1.desc": "Based on the SM-2 algorithm used by Anki — the system calculates the optimal moment to show each card. Review less, retain much longer.",
    "landing.feat2.title": "Anki & PDF Export",
    "landing.feat2.desc": "Export your flashcards as .apkg for Anki, PDF for printing, or CSV for other tools.",
    "landing.feat3.title": "Gamification & progress",
    "landing.feat3.desc": "Earn XP, level up and unlock badges each session. The dashboard tracks your progress by subject.",
    "landing.feat4.title": "Community library",
    "landing.feat4.desc": "Share your decks with the community or copy flashcards created by other students on the same subjects.",
    "landing.free.title": "🎁 What's free?",
    "landing.free.sub": "No credit card needed to get started.",
    "landing.free.gen": "free AI generation<br/><span class=\"text-xs font-normal text-slate-400\">(10 pages · 10 cards)</span>",
    "landing.free.decks": "manual decks<br/>unlimited",
    "landing.free.practice": "reviews &<br/>Practice",
    "landing.free.premium": "Premium: 20 generations/month · Anki & PDF export · Advanced stats — <strong>€3.99/month</strong>",
    "landing.faq.title": "Frequently asked questions",
    "landing.card.label.question": "Question",
    "landing.card.question": "What is photosynthesis?",
    "landing.card.label.answer": "Answer",
    "landing.card.answer": "The process by which plants convert light into chemical energy using chlorophyll…",
    "landing.card.label.summary": "Summary",
    "landing.card.summary": "Photosynthesis is the reaction 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂, catalyzed by chlorophyll…",
    "landing.faq.q1": "Are the flashcards good quality?",
    "landing.faq.a1": "Yes — FormelyAI uses the best generative AI on the market to analyze your course and generate relevant questions, not just copy-paste. Summaries are structured and questions target key concepts. You can always edit or delete generated cards.",
    "landing.faq.q2": "Which languages are supported?",
    "landing.faq.a2": "FormelyAI natively supports French and English. The AI understands and generates cards in your course's language — if you upload a Spanish PDF, the cards will be in Spanish.",
    "landing.faq.q3": "How does smart review work?",
    "landing.faq.a3": "We use the SM-2 algorithm (the same as Anki). After each review, you indicate whether you knew the answer. The system automatically calculates when to show you the card again — the better you know it, the longer the interval grows.",
    "landing.faq.q4": "Can I export to Anki?",
    "landing.faq.a4": "Yes, with the Premium plan. You can export any deck as an .apkg file compatible with Anki desktop and mobile. You can also export as PDF or CSV.",
    "landing.faq.q5": "Is my data secure?",
    "landing.faq.a5": "Your PDFs are not stored on our servers — only the generated cards. All data is encrypted in transit (HTTPS) and hosted in Europe. You can delete your account and all your data at any time.",
    "landing.cta.try": "✦ Try now — it's free",
    "due.start": "Review now",
    "due.widget": (n) => `${n} card${n > 1 ? "s" : ""} due today`,
    "due.session": (n) => `${n} due`,
  },
};

function t(key) {
  const tr = TRANSLATIONS[lang] || TRANSLATIONS["fr"];
  return tr[key] !== undefined ? tr[key] : (TRANSLATIONS["fr"][key] !== undefined ? TRANSLATIONS["fr"][key] : key);
}

// Keys whose translations contain HTML tags — use innerHTML instead of textContent
const I18N_HTML_KEYS = new Set([
  "landing.h1", "landing.free.gen", "landing.free.decks",
  "landing.free.practice", "landing.free.premium",
  "paywall.secure",
]);

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (typeof val === "string") {
      if (I18N_HTML_KEYS.has(key)) el.innerHTML = val;
      else el.textContent = val;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const val = t(el.dataset.i18nPlaceholder);
    if (typeof val === "string") el.placeholder = val;
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const val = t(el.dataset.i18nTitle);
    if (typeof val === "string") el.title = val;
  });
  const btn = document.getElementById("langToggleBtn");
  if (btn) btn.innerHTML = lang === "fr" ? "🇬🇧 EN" : "🇫🇷 FR";
  document.documentElement.lang = lang;
  populateSubjectSelects();
  // Re-apply switchAuthTab strings if modal is visible
  if (document.getElementById("authModal") && !document.getElementById("authModal").classList.contains("hidden")) {
    switchAuthTab(authTab);
  }
}

function setLanguage(l) {
  lang = l;
  localStorage.setItem("lang", l);
  applyTranslations();
  updateNavbar();
  if (currentSession) renderResults(currentSession);
  renderSessionList(_lastSessions);
}

function toggleLang() {
  setLanguage(lang === "fr" ? "en" : "fr");
}

// ─────────────────────────────────────────────────────────────────────────────
// API helper — sends cookies, handles 401 / 403
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, { credentials: "include", ...options });

  if (res.status === 401) {
    currentUser = null;
    showAuthModal();
    throw new Error(AUTH_ERROR);
  }

  if (res.status === 403) {
    let detail = "Accès refusé";
    try { detail = (await res.json()).detail || detail; } catch {}
    if (detail === "upgrade_required" || detail === "quota_exceeded" || detail === "premium_required") {
      showPaywall(detail);
    } else {
      showToast(detail, "danger");
    }
    throw new Error(detail);
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// KaTeX
// ─────────────────────────────────────────────────────────────────────────────
window.renderMathInDocument = function () {
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      strict: false,
    });
  }
};
window.addEventListener("load", () => window.renderMathInDocument());

// ─────────────────────────────────────────────────────────────────────────────
// Auth modal
// ─────────────────────────────────────────────────────────────────────────────
function showAuthModal(tab = "login") {
  switchAuthTab(tab);
  document.getElementById("authModal").classList.remove("hidden");
  document.getElementById("authModal").classList.add("flex");
  setTimeout(() => document.getElementById("authEmail").focus(), 50);
  // Re-render Google button now that the container is visible
  setTimeout(() => {
    const container = document.getElementById("googleBtnContainer");
    if (container && window.google?.accounts?.id && window.__GOOGLE_CLIENT_ID__) {
      container.innerHTML = "";
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: container.offsetWidth || 320,
      });
    }
  }, 50);
}

function hideAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
  document.getElementById("authModal").classList.remove("flex");
}

function switchAuthTab(tab) {
  authTab = tab;
  const isLogin = tab === "login";

  document.getElementById("authTabLogin").className =
    "flex-1 py-2 rounded-lg text-sm font-semibold transition " +
    (isLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700");
  document.getElementById("authTabRegister").className =
    "flex-1 py-2 rounded-lg text-sm font-semibold transition " +
    (!isLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700");

  document.getElementById("authSubmitText").textContent = isLogin ? t("auth.submit.login") : t("auth.submit.register");
  document.getElementById("authSubmitBtn").querySelector("i").className =
    isLogin ? "bi bi-box-arrow-in-right" : "bi bi-person-plus";
  document.getElementById("authPasswordHint").classList.toggle("hidden", isLogin);
  document.getElementById("authSwitchText").textContent = isLogin ? t("auth.no.account") : t("auth.has.account");
  document.getElementById("authSwitchBtn").textContent = isLogin ? t("auth.register") : t("auth.login");
  document.getElementById("authSwitchBtn").onclick = () => switchAuthTab(isLogin ? "register" : "login");

  clearAuthError();
  if (document.getElementById("authPassword")) {
    document.getElementById("authPassword").autocomplete = isLogin ? "current-password" : "new-password";
  }
}

function showAuthError(msg) {
  document.getElementById("authErrorText").textContent = msg;
  document.getElementById("authError").classList.remove("hidden");
  document.getElementById("authError").classList.add("flex");
}

function clearAuthError() {
  document.getElementById("authError").classList.add("hidden");
  document.getElementById("authError").classList.remove("flex");
}

async function submitAuth(event) {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  clearAuthError();

  const btn = document.getElementById("authSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2"></span>${t("auth.loading")}`;

  try {
    const endpoint = authTab === "login" ? "/auth/login" : "/auth/register";
    const res = await fetch(API_BASE + endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.detail || "Erreur de connexion.");
      return;
    }
    currentUser = data;
    hideAuthModal();
    updateNavbar();
    await loadSessions();
    showToast(authTab === "login" ? t("toast.welcome") : t("toast.registered"), "success");
  } catch {
    showAuthError(t("toast.network"));
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="${authTab === "login" ? "bi bi-box-arrow-in-right" : "bi bi-person-plus"}"></i><span id="authSubmitText">${authTab === "login" ? t("auth.submit.login") : t("auth.submit.register")}</span>`;
  }
}

async function logout() {
  try {
    await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" });
  } catch {}
  currentUser = null;
  currentSessionId = null;
  currentSession = null;
  updateNavbar();
  showUpload();
  showToast(t("toast.logout"), "info");
}

// ─────────────────────────────────────────────────────────────────────────────
// Forgot / Reset password
// ─────────────────────────────────────────────────────────────────────────────
function showForgotModal() {
  document.getElementById("forgotEmail").value = "";
  document.getElementById("forgotSuccess").classList.add("hidden");
  document.getElementById("forgotError").classList.add("hidden");
  document.getElementById("forgotForm").classList.remove("hidden");
  document.getElementById("forgotModal").classList.remove("hidden");
  document.getElementById("forgotModal").classList.add("flex");
  setTimeout(() => document.getElementById("forgotEmail").focus(), 50);
}

function hideForgotModal() {
  document.getElementById("forgotModal").classList.add("hidden");
  document.getElementById("forgotModal").classList.remove("flex");
}

async function submitForgotPassword(event) {
  event.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim();
  const btn = document.getElementById("forgotSubmitBtn");
  const errEl = document.getElementById("forgotError");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2"></span>${t("forgot.sending")}`;
  try {
    await fetch(API_BASE + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    document.getElementById("forgotForm").classList.add("hidden");
    document.getElementById("forgotSuccess").classList.remove("hidden");
  } catch {
    errEl.textContent = t("toast.network");
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-send"></i><span>${t("forgot.send")}</span>`;
  }
}

function showResetModal(token) {
  document.getElementById("resetPassword").value = "";
  document.getElementById("resetError").classList.add("hidden");
  document.getElementById("resetModal").classList.remove("hidden");
  document.getElementById("resetModal").classList.add("flex");
  document.getElementById("resetModal").dataset.token = token;
  setTimeout(() => document.getElementById("resetPassword").focus(), 50);
}

async function submitResetPassword(event) {
  event.preventDefault();
  const password = document.getElementById("resetPassword").value;
  const token = document.getElementById("resetModal").dataset.token;
  const btn = document.getElementById("resetSubmitBtn");
  const errEl = document.getElementById("resetError");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = t("reset.saving");
  try {
    const res = await fetch(API_BASE + "/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.detail || "Erreur.";
      errEl.classList.remove("hidden");
      return;
    }
    document.getElementById("resetModal").classList.add("hidden");
    document.getElementById("resetModal").classList.remove("flex");
    history.replaceState({}, "", "/");
    showToast(t("reset.success"), "success");
    showAuthModal("login");
  } catch {
    errEl.textContent = t("toast.network");
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = t("reset.submit");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legal modals
// ─────────────────────────────────────────────────────────────────────────────
const LEGAL_CONTENT = {
  mentions: {
    fr: { title: "Mentions légales", body: `
      <p><strong>Éditeur :</strong> FormelyAI — Application web éducative</p>
      <p><strong>Hébergeur :</strong> Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, USA</p>
      <p><strong>Base de données :</strong> Supabase (Postgres)</p>
      <p><strong>Contact :</strong> support@formely-ai.com</p>
      <p>Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique.</p>
    ` },
    en: { title: "Legal Notice", body: `
      <p><strong>Publisher:</strong> FormelyAI — Educational web application</p>
      <p><strong>Host:</strong> Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, USA</p>
      <p><strong>Database:</strong> Supabase (Postgres)</p>
      <p><strong>Contact:</strong> support@formely-ai.com</p>
    ` },
  },
  cgu: {
    fr: { title: "Conditions Générales d'Utilisation", body: `
      <p><strong>1. Objet</strong><br>FormelyAI est un service permettant de générer des fiches de révision à partir de documents PDF ou de textes, grâce à l'intelligence artificielle.</p>
      <p><strong>2. Accès au service</strong><br>L'accès est possible sans inscription pour la génération (dans la limite du plan gratuit). La création d'un compte permet de sauvegarder les sessions.</p>
      <p><strong>3. Plan gratuit et Premium</strong><br>Le plan gratuit permet 1 upload PDF. Le plan Premium (3,99 €/mois) offre 20 uploads par mois et des fonctionnalités avancées. Des crédits supplémentaires sont disponibles à 1 € pour 3 PDF.</p>
      <p><strong>4. Données utilisateur</strong><br>Les contenus uploadés sont traités par l'IA et stockés pour permettre la révision. L'utilisateur reste propriétaire de ses données.</p>
      <p><strong>5. Responsabilité</strong><br>FormelyAI ne garantit pas l'exactitude des fiches générées par l'IA. L'utilisateur est invité à vérifier les informations.</p>
      <p><strong>6. Résiliation</strong><br>L'abonnement Premium peut être résilié à tout moment via le portail Stripe. L'accès Premium reste actif jusqu'à la fin de la période payée.</p>
      <p><strong>7. Droit applicable</strong><br>Les présentes CGU sont soumises au droit français.</p>
    ` },
    en: { title: "Terms of Service", body: `
      <p><strong>1. Purpose</strong><br>FormelyAI is a service that generates revision flashcards from PDF documents or text using artificial intelligence.</p>
      <p><strong>2. Access</strong><br>Free access allows 1 PDF upload. Creating an account enables session saving.</p>
      <p><strong>3. Free & Premium plans</strong><br>The Premium plan (€3.99/month) offers 20 uploads per month and advanced features. Additional credits are available at €1 for 3 PDFs.</p>
      <p><strong>4. User data</strong><br>Uploaded content is processed by AI and stored to enable revision. Users retain ownership of their data.</p>
      <p><strong>5. Liability</strong><br>FormelyAI does not guarantee the accuracy of AI-generated cards. Users should verify information.</p>
      <p><strong>6. Cancellation</strong><br>Premium subscriptions can be cancelled anytime via the Stripe portal.</p>
      <p><strong>7. Governing law</strong><br>These terms are governed by French law.</p>
    ` },
  },
  privacy: {
    fr: { title: "Politique de confidentialité", body: `
      <p><strong>Données collectées :</strong></p>
      <ul class="list-disc pl-5 space-y-1">
        <li>Adresse email (inscription)</li>
        <li>Contenu des documents uploadés (traité par l'IA Anthropic)</li>
        <li>Données de paiement (gérées par Stripe, non stockées par FormelyAI)</li>
        <li>Statistiques d'utilisation (révisions, XP)</li>
      </ul>
      <p><strong>Finalité :</strong> Fourniture du service, amélioration de l'expérience utilisateur.</p>
      <p><strong>Conservation :</strong> Les données sont conservées tant que le compte est actif. Suppression sur demande à support@formely-ai.com.</p>
      <p><strong>Sous-traitants :</strong> Anthropic (IA), Stripe (paiements), Supabase (base de données), Vercel (hébergement).</p>
      <p><strong>Droits :</strong> Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Contact : support@formely-ai.com</p>
    ` },
    en: { title: "Privacy Policy", body: `
      <p><strong>Data collected:</strong></p>
      <ul class="list-disc pl-5 space-y-1">
        <li>Email address (registration)</li>
        <li>Content of uploaded documents (processed by Anthropic AI)</li>
        <li>Payment data (managed by Stripe, not stored by FormelyAI)</li>
        <li>Usage statistics (reviews, XP)</li>
      </ul>
      <p><strong>Purpose:</strong> Service delivery, improving user experience.</p>
      <p><strong>Retention:</strong> Data is retained while the account is active. Deletion on request at support@formely-ai.com.</p>
      <p><strong>Sub-processors:</strong> Anthropic (AI), Stripe (payments), Supabase (database), Vercel (hosting).</p>
      <p><strong>Rights:</strong> Under GDPR, you have the right to access, rectify and delete your data. Contact: support@formely-ai.com</p>
    ` },
  },
};

function showLegal(type) {
  const content = LEGAL_CONTENT[type]?.[lang] || LEGAL_CONTENT[type]?.["fr"];
  if (!content) return;
  document.getElementById("legalTitle").textContent = content.title;
  document.getElementById("legalContent").innerHTML = content.body;
  document.getElementById("legalModal").classList.remove("hidden");
  document.getElementById("legalModal").classList.add("flex");
}

function hideLegal() {
  document.getElementById("legalModal").classList.add("hidden");
  document.getElementById("legalModal").classList.remove("flex");
}

function showContact() {
  document.getElementById("contactModal").classList.remove("hidden");
  document.getElementById("contactModal").classList.add("flex");
}

function hideContact() {
  document.getElementById("contactModal").classList.add("hidden");
  document.getElementById("contactModal").classList.remove("flex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth
// ─────────────────────────────────────────────────────────────────────────────
async function handleGoogleCredential(response) {
  try {
    const res = await fetch(API_BASE + "/auth/google", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || t("toast.google.error"), "danger");
      return;
    }
    currentUser = data;
    hideAuthModal();
    updateNavbar();
    await loadSessions();
    showToast(t("toast.welcome"), "success");
  } catch {
    showToast(t("toast.google.error"), "danger");
  }
}

// Expose globally so Google GSI can call it as a string callback
window.handleGoogleCredential = handleGoogleCredential;

function _initGoogleSignIn() {
  const clientId = window.__GOOGLE_CLIENT_ID__;
  if (!clientId || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  });
  // renderButton est plus fiable que prompt() sur mobile (pas de popup bloqué)
  const container = document.getElementById("googleBtnContainer");
  if (container) {
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 320,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────────────────────
function updateNavbar() {
  const navUser = document.getElementById("navUser");
  const navAuth = document.getElementById("navAuth");
  const navPlanBadge = document.getElementById("navPlanBadge");
  const navUpgradeBtn = document.getElementById("navUpgradeBtn");

  const landingHero = document.getElementById("landingHero");
  const uploadFormHeader = document.getElementById("uploadFormHeader");

  const mobileNavRow = document.getElementById("mobileNavRow");

  if (currentUser) {
    if (mobileNavRow) mobileNavRow.classList.remove("hidden");
    document.body.classList.add("has-nav2");
    if (landingHero) landingHero.classList.add("hidden");
    if (uploadFormHeader) uploadFormHeader.classList.remove("hidden");
    navUser.classList.remove("hidden");
    navUser.classList.add("flex");
    navAuth.style.display = "none";

    const navLibraryBtn = document.getElementById("navLibraryBtn");
    if (currentUser.plan === "premium") {
      navPlanBadge.classList.remove("hidden");
      navUpgradeBtn.classList.add("hidden");
    } else {
      navPlanBadge.classList.add("hidden");
      navUpgradeBtn.classList.remove("hidden");
    }
    // Library and Practice visible to all logged-in users
    if (navLibraryBtn) { navLibraryBtn.classList.remove("hidden"); navLibraryBtn.classList.add("flex"); }
    const navPracticeBtn = document.getElementById("navPracticeBtn");
    if (navPracticeBtn) { navPracticeBtn.classList.remove("hidden"); navPracticeBtn.classList.add("flex"); }
    const navDashboardBtn = document.getElementById("navDashboardBtn");
    if (navDashboardBtn) { navDashboardBtn.classList.remove("hidden"); navDashboardBtn.classList.add("flex"); }
    const navAdminBtn = document.getElementById("navAdminBtn");
    const mobileAdminBtn = document.getElementById("mobileAdminBtn");
    if (currentUser.is_admin) {
      if (navAdminBtn) { navAdminBtn.classList.remove("hidden"); navAdminBtn.classList.add("flex"); }
      if (mobileAdminBtn) { mobileAdminBtn.classList.remove("hidden"); mobileAdminBtn.classList.add("flex"); }
    } else {
      if (navAdminBtn) navAdminBtn.classList.add("hidden");
      if (mobileAdminBtn) mobileAdminBtn.classList.add("hidden");
    }
    updateUsageBar();
    updateXPWidget(currentUser);
    // Show free limit notice only for free users
    const freeLimitNotice = document.getElementById("freeLimitNotice");
    if (freeLimitNotice) {
      if (currentUser.plan === "free" && !currentUser.is_admin) {
        freeLimitNotice.classList.remove("hidden");
        freeLimitNotice.classList.add("flex");
      } else {
        freeLimitNotice.classList.add("hidden");
        freeLimitNotice.classList.remove("flex");
      }
    }
  } else {
    if (landingHero) landingHero.classList.remove("hidden");
    if (uploadFormHeader) uploadFormHeader.classList.add("hidden");
    const freeLimitNotice = document.getElementById("freeLimitNotice");
    if (freeLimitNotice) { freeLimitNotice.classList.add("hidden"); freeLimitNotice.classList.remove("flex"); }
    if (mobileNavRow) mobileNavRow.classList.add("hidden");
    document.body.classList.remove("has-nav2");
    navUser.classList.add("hidden");
    navUser.classList.remove("flex");
    const widget = document.getElementById("navXPWidget");
    if (widget) { widget.classList.add("hidden"); widget.classList.remove("flex"); }
    const navPracticeBtn2 = document.getElementById("navPracticeBtn");
    if (navPracticeBtn2) { navPracticeBtn2.classList.add("hidden"); navPracticeBtn2.classList.remove("flex"); }
    const navDashboardBtn2 = document.getElementById("navDashboardBtn");
    if (navDashboardBtn2) { navDashboardBtn2.classList.add("hidden"); navDashboardBtn2.classList.remove("flex"); }
    navAuth.style.display = "flex";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function updateUsageBar() {
  if (!currentUser) return;
  const bar = document.getElementById("usageBar");
  const usageText = document.getElementById("usageText");
  const upgradeBtn = document.getElementById("usageUpgradeBtn");
  if (!bar || !usageText || !upgradeBtn) return;

  bar.classList.remove("hidden");
  bar.classList.add("flex");

  const label = currentUser.plan === "premium" ? t("usage.month") : t("usage.total");
  usageText.textContent = `${t("usage.pdf")(currentUser.pdfs_used, currentUser.monthly_limit)} ${label}`;

  if (currentUser.plan !== "premium") {
    upgradeBtn.classList.remove("hidden");
    upgradeBtn.classList.add("flex");
  } else {
    upgradeBtn.classList.add("hidden");
  }
}

// Paywall
// ─────────────────────────────────────────────────────────────────────────────
function showPaywall(reason = "upgrade_required") {
  const modal = document.getElementById("paywallModal");
  const title = document.getElementById("paywallTitle");
  const subtitle = document.getElementById("paywallSubtitle");

  if (reason === "quota_exceeded") {
    title.textContent = t("paywall.title.quota");
    subtitle.textContent = t("paywall.subtitle.quota");
  } else if (reason === "premium_required") {
    title.textContent = t("paywall.title.premium");
    subtitle.textContent = t("paywall.subtitle.premium");
  } else {
    title.textContent = t("paywall.title.upgrade");
    subtitle.textContent = t("paywall.subtitle.upgrade");
  }

  // Affiche "Gérer" pour les premium, "S'abonner" pour les autres
  const isPremium = currentUser?.plan === "premium";
  document.getElementById("paywallSubscribeBtn")?.classList.toggle("hidden", isPremium);
  document.getElementById("paywallManageBtn")?.classList.toggle("hidden", !isPremium);

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closePaywall() {
  document.getElementById("paywallModal").classList.add("hidden");
  document.getElementById("paywallModal").classList.remove("flex");
}

async function subscribePremium() {
  try {
    const res = await apiFetch("/billing/subscribe", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showToast(t("toast.stripe.error"), "danger");
  } catch (err) {
    if (err.message !== t("toast.no.auth") && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

async function manageSubscription() {
  try {
    const res = await apiFetch("/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showToast(t("toast.stripe.error"), "danger");
  } catch (err) {
    if (err.message !== AUTH_ERROR) showToast("Erreur : " + err.message, "danger");
  }
}

async function buyCredits() {
  try {
    const res = await apiFetch("/billing/credits", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showToast(t("toast.stripe.error"), "danger");
  } catch (err) {
    if (err.message !== t("toast.no.auth") && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

function showUpgrade() {
  showPaywall("upgrade_required");
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject input (free text + datalist suggestions)
// ─────────────────────────────────────────────────────────────────────────────
const SUBJECT_SUGGESTIONS_FR = [
  "Mathématiques", "Physique", "Chimie", "SVT", "Sciences de l'Ingénieur (SI)",
  "Histoire-Géographie", "Philosophie", "Français", "Anglais", "Espagnol",
  "Économie-Sociologie (SES)", "Informatique (NSI)", "Droit", "Médecine / Santé",
];
const SUBJECT_SUGGESTIONS_EN = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Engineering Sciences",
  "History & Geography", "Philosophy", "French", "English", "Spanish",
  "Economics", "Computer Science", "Law", "Medicine / Health",
];

function populateSubjectDatalist() {
  const datalist = document.getElementById("subjectDatalist");
  if (!datalist) return;

  const predefined = lang === "en" ? SUBJECT_SUGGESTIONS_EN : SUBJECT_SUGGESTIONS_FR;
  // Add user's own past subjects (deduplicated)
  const userSubjects = [...new Set(
    _lastSessions.map((s) => s.subject).filter(Boolean)
  )].filter((s) => !predefined.includes(s));

  datalist.innerHTML = [...predefined, ...userSubjects]
    .map((s) => `<option value="${s.replace(/"/g, "&quot;")}">`)
    .join("");
}

// Called from applyTranslations (replaces old populateSubjectSelects)
function populateSubjectSelects() {
  populateSubjectDatalist();
}

function getSubject(inputId) {
  return (document.getElementById(inputId)?.value.trim()) || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload / generate
// ─────────────────────────────────────────────────────────────────────────────
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const f = e.dataTransfer.files[0];
  if (f && f.type === "application/pdf") setFile(f);
  else showToast(t("toast.pdf.only"), "danger");
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(f) {
  fileInput._file = f;
  document.getElementById("fileChosenName").textContent = f.name;
  document.getElementById("fileChosen").classList.remove("hidden");
  document.getElementById("fileChosen").classList.add("flex");
  dropZone.classList.add("file-chosen");
}

async function handleUpload() {
  const subject = getSubject("subjectInput") || "Général";
  const textVal = document.getElementById("textInput").value.trim();
  const file = fileInput._file || fileInput.files[0];

  if (!file && !textVal) {
    showToast(t("toast.no.content"), "warning");
    return;
  }
  if (file && file.size > 20 * 1024 * 1024) {
    showToast(t("toast.pdf.large")(20), "danger");
    return;
  }

  showLoading();

  const fd = new FormData();
  fd.append("subject", subject);
  if (file) fd.append("file", file);
  else fd.append("text", textVal);

  try {
    const res = await fetch(API_BASE + "/upload", { method: "POST", body: fd, credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Erreur serveur");

    if (data.anonymous) {
      // Résultats anonymes — afficher sans sauvegarder
      currentSessionId = null;
      currentSession = null;
      showAnonymousResults(data);
    } else {
      await refreshUser();
      if (data.xp_events) handleXPEvents(data.xp_events);
      currentSessionId = data.session_id;
      await loadAndShowSession(currentSessionId);
      await loadSessions();

      // Show free limit banner if applicable
      const banner = document.getElementById("freeLimitBanner");
      const bannerText = document.getElementById("freeLimitBannerText");
      if (banner && bannerText && data.free_limit_applied) {
        const pagesLimited = data.pages_extracted != null && data.pages_total != null && data.pages_extracted < data.pages_total;
        const qaLimited = data.qa_count != null && data.qa_count >= 10;
        if (pagesLimited && qaLimited) {
          bannerText.textContent = t("results.free.limit.both")(data.pages_extracted, data.pages_total, data.qa_count);
        } else if (pagesLimited) {
          bannerText.textContent = t("results.free.limit.pages")(data.pages_extracted, data.pages_total);
        } else if (qaLimited) {
          bannerText.textContent = t("results.free.limit.qa")(data.qa_count);
        }
        if (pagesLimited || qaLimited) banner.classList.remove("hidden");
      }
    }
  } catch (err) {
    showUpload();
    if (err.message === "pdf_too_large") {
      showToast(t("toast.pdf.large")(20), "danger");
    } else if (err.message !== AUTH_ERROR && err.message !== "upgrade_required" && err.message !== "quota_exceeded" && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

function showAnonymousResults(data) {
  hideAll();
  document.getElementById("resultsSection").classList.remove("hidden");
  // Construit un objet session fictif pour renderResults
  const now = new Date().toISOString();
  const fakeSession = {
    id: null,
    title: data.title,
    subject: data.subject || "Général",
    created_at: now,
    qa_items: (data.qa_items || []).map((q, i) => ({
      id: i,
      question: q.question,
      answer: q.answer,
      review_count: 0,
      next_review: now,
      ease_factor: 2.5,
      interval: 0,
    })),
    summaries: (data.summaries || []).map((s, i) => ({
      id: i,
      chapter_title: s.chapter_title,
      content: s.content,
    })),
  };

  renderResults(fakeSession);

  // Banner pour inciter à se connecter
  const banner = document.getElementById("freeLimitBanner");
  const bannerText = document.getElementById("freeLimitBannerText");
  if (banner && bannerText) {
    bannerText.textContent = t("results.anon.save");
    banner.classList.remove("hidden");
    // Remplace le bouton "Passer Premium" par "Se connecter"
    const btn = banner.querySelector("button");
    if (btn) {
      btn.textContent = t("nav.login");
      btn.onclick = () => showAuthModal("register");
    }
  }
}

async function refreshUser() {
  try {
    const res = await fetch(API_BASE + "/auth/me", { credentials: "include" });
    if (res.ok) {
      currentUser = await res.json();
      updateNavbar();
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Session list
// ─────────────────────────────────────────────────────────────────────────────
async function loadSessions() {
  try {
    const res = await apiFetch("/sessions");
    const sessions = await res.json();
    renderSessionList(sessions);
  } catch {}
}

function renderSessionList(sessions) {
  const elDesktop = document.getElementById("sessionList");
  const elMobile = document.getElementById("sessionListMobile");

  _lastSessions = sessions;
  populateSubjectDatalist();
  if (!sessions.length) {
    const empty = `<p class="text-slate-400 text-xs text-center mt-4">${t("session.empty")}</p>`;
    elDesktop.innerHTML = empty;
    if (elMobile) elMobile.innerHTML = empty;
    return;
  }

  // Update due widget
  const totalDue = sessions.reduce((sum, s) => sum + (s.due_count || 0), 0);
  const dueWidget = document.getElementById("dueWidget");
  const dueWidgetText = document.getElementById("dueWidgetText");
  if (dueWidget && dueWidgetText && currentUser) {
    if (totalDue > 0) {
      dueWidgetText.textContent = t("due.widget")(totalDue);
      dueWidget.classList.remove("hidden");
      dueWidget.classList.add("flex");
    } else {
      dueWidget.classList.add("hidden");
      dueWidget.classList.remove("flex");
    }
  }

  const html = sessions
    .map(
      (s) => `
    <div class="session-item ${s.id === currentSessionId ? "active" : ""}" onclick="loadAndShowSession(${s.id})">
      <div class="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">${escHtml(s.title)}</div>
      ${s.owner_email ? `<div class="text-xs text-violet-500 font-medium truncate mt-0.5"><i class="bi bi-person-fill"></i> ${escHtml(s.owner_email)}</div>` : ""}
      <div class="flex justify-between items-center text-xs gap-1 mt-1">
        <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-1.5 py-0.5 rounded-md">${escHtml(s.subject || "Général")}</span>
        <span class="text-slate-400">${formatDate(s.created_at)}</span>
      </div>
      <div class="flex justify-between items-center text-xs gap-1 mt-1">
        <small class="text-slate-400"><i class="bi bi-card-text mr-0.5"></i>${s.qa_count} ${t("session.qa")} &nbsp; <i class="bi bi-journal mr-0.5"></i>${s.summary_count} ${t("session.summaries")}</small>
        <div class="flex items-center gap-1.5">
          ${s.due_count > 0 ? `<span class="text-amber-600 font-semibold text-xs flex items-center gap-0.5"><i class="bi bi-alarm"></i>${s.due_count}</span>` : ""}
          <button class="text-red-400 hover:text-red-600 p-0 transition delete-btn opacity-0"
            style="background:none;border:none;cursor:pointer;"
            onclick="deleteSession(event, ${s.id})">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  elDesktop.innerHTML = html;
  if (elMobile) elMobile.innerHTML = html;

  [elDesktop, elMobile].filter(Boolean).forEach((el) => {
    el.querySelectorAll(".session-item").forEach((item) => {
      const btn = item.querySelector(".delete-btn");
      if (!btn) return;
      item.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
      item.addEventListener("mouseleave", () => (btn.style.opacity = "0"));
    });
  });
}

async function loadAndShowSession(id) {
  showLoading(t("loading.session"));
  try {
    const res = await apiFetch(`/sessions/${id}`);
    if (!res.ok) throw new Error(t("error.session"));
    const session = await res.json();
    currentSessionId = id;
    renderResults(session);
    loadSessions();
  } catch (err) {
    showUpload();
    if (err.message !== AUTH_ERROR) showToast(err.message, "danger");
  }
}

async function deleteSession(event, id) {
  event.stopPropagation();
  showConfirm(t("confirm.session.title"), t("confirm.session.msg"), async () => {
    await apiFetch(`/sessions/${id}`, { method: "DELETE" });
    if (currentSessionId === id) showUpload();
    await loadSessions();
    showToast(t("toast.deleted.session"), "success");
  });
}

function startRenameSession() {
  if (!currentSession) return;
  const titleEl = document.getElementById("resultsTitleText");
  const current = titleEl.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.value = current;
  input.className = "font-bold text-xl bg-transparent border-b-2 border-violet-500 outline-none text-slate-900 dark:text-slate-100 w-full max-w-xs";

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newTitle = input.value.trim() || current;
    const span = document.createElement("span");
    span.id = "resultsTitleText";
    span.textContent = newTitle;
    input.replaceWith(span);
    if (newTitle === current) return;
    try {
      await apiFetch(`/sessions/${currentSession.id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      currentSession.title = newTitle;
      // Update sidebar
      const s = _lastSessions.find(s => s.id === currentSession.id);
      if (s) { s.title = newTitle; renderSessionList(_lastSessions); }
    } catch {
      span.textContent = current; // revert on error
    }
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { input.value = current; input.blur(); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Render results
// ─────────────────────────────────────────────────────────────────────────────
function renderResults(session) {
  currentSession = session;
  document.getElementById("resultsTitleText").textContent = session.title;
  document.getElementById("resultsSubtitle").textContent = `${session.subject || "Général"} · ${formatDate(session.created_at)}`;

  const now = new Date();
  const dueCount = session.qa_items.filter((q) => new Date(q.next_review) <= now).length;
  document.getElementById("statsRow").innerHTML = `
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-violet-600">${session.qa_items.length}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">${t("stats.questions")}</div>
    </div>
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-amber-500">${dueCount}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">${t("stats.review")}</div>
    </div>
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-emerald-500">${session.summaries.length}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">${t("stats.summaries")}</div>
    </div>
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-sky-500">${session.qa_items.reduce((a, q) => a + q.review_count, 0)}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">${t("stats.revisions")}</div>
    </div>
  `;

  document.getElementById("qaTabBadge").textContent = session.qa_items.length;
  document.getElementById("summaryTabBadge").textContent = session.summaries.length;

  const qaCards = document.getElementById("qaCards");
  qaCards.innerHTML = session.qa_items
    .map((q, i) => {
      const due = new Date(q.next_review) <= now;
      const daysLeft = Math.ceil((new Date(q.next_review) - now) / 86400000);
      const badge = due
        ? `<span class="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1"><i class="bi bi-alarm"></i>${t("card.due")}</span>`
        : `<span class="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1"><i class="bi bi-check2"></i>${daysLeft}${t("card.days")}</span>`;

      const qEsc = escHtml(q.question).replace(/'/g, "&#39;");
      const aEsc = escHtml(q.answer).replace(/'/g, "&#39;");
      return `
    <div class="flashcard" id="fc-${q.id}" onclick="flipCard(${q.id})">
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flex justify-between items-start mb-1">
            <div class="text-xs font-bold tracking-wider uppercase" style="color:#7c3aed">${i + 1}</div>
            <div class="flex gap-1 card-actions opacity-0 transition-opacity">
              <button class="text-slate-300 hover:text-violet-500 transition p-0.5" onclick="event.stopPropagation(); openEditQaModal(${q.id}, '${qEsc}', '${aEsc}')" title="Modifier">
                <i class="bi bi-pencil text-xs"></i>
              </button>
              <button class="text-slate-300 hover:text-red-400 transition p-0.5" onclick="deleteQa(event, ${q.id})" title="Supprimer">
                <i class="bi bi-trash3 text-xs"></i>
              </button>
            </div>
          </div>
          <div class="text-sm font-semibold leading-snug flex-1">${escHtml(sanitizeMath(q.question))}</div>
          <div class="text-slate-400 text-xs mt-auto pt-2">
            <i class="bi bi-hand-index mr-1"></i>${t("card.click")}
          </div>
        </div>
        <div class="flashcard-back">
          <div class="text-sm leading-relaxed flex-1">${escHtml(sanitizeMath(q.answer))}</div>
          <div class="flex justify-between items-center mt-auto pt-2">
            ${badge}
            <button
              class="border border-violet-300 text-violet-600 hover:bg-violet-50 text-xs px-2 py-1 rounded-lg transition flex items-center gap-1"
              onclick="markReviewed(event, ${q.id})">
              <i class="bi bi-check-lg"></i>${t("card.reviewed")}
            </button>
          </div>
        </div>
      </div>
    </div>`;
    })
    .join("");

  const acc = document.getElementById("summaryAccordion");
  acc.innerHTML = session.summaries
    .map(
      (s, i) => `
    <details class="bg-white rounded-2xl overflow-hidden border border-slate-200" ${i === 0 ? "open" : ""}>
      <summary class="flex items-center gap-2.5 px-4 py-3.5 font-semibold cursor-pointer select-none hover:bg-violet-50 transition list-none text-slate-700">
        <i class="bi bi-bookmark-fill text-violet-500 text-xs"></i>
        ${escHtml(s.chapter_title)}
        <i class="bi bi-chevron-down ml-auto details-chevron transition-transform text-slate-400 text-xs"></i>
      </summary>
      <div class="px-4 pb-5 pt-2 summary-content border-t border-slate-100">${escHtml(sanitizeMath(s.content))}</div>
    </details>
  `
    )
    .join("");

  acc.querySelectorAll("details").forEach((det) => {
    det.addEventListener("toggle", () => {
      const chevron = det.querySelector(".details-chevron");
      if (chevron) chevron.style.transform = det.open ? "rotate(180deg)" : "rotate(0deg)";
    });
    const chevron = det.querySelector(".details-chevron");
    if (chevron && det.open) chevron.style.transform = "rotate(180deg)";
  });

  updatePublishBtn(session.is_public || false);
  showResults();

  setTimeout(() => {
    if (window.renderMathInElement) {
      const opts = {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        strict: false,
      };
      renderMathInElement(document.getElementById("qaCards"), opts);
      renderMathInElement(document.getElementById("summaryAccordion"), opts);
    }
  }, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flashcard interactions
// ─────────────────────────────────────────────────────────────────────────────
function flipCard(id) {
  const card = document.getElementById(`fc-${id}`);
  if (card) card.classList.toggle("flipped");
}

async function markReviewed(event, id) {
  event.stopPropagation();
  try {
    const res = await apiFetch(`/qa/${id}/review`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    await loadAndShowSession(currentSessionId);
    handleXPEvents(data.xp_events);
    showToast(t("toast.reviewed"), "success");
  } catch (err) {
    if (err.message !== AUTH_ERROR) showToast("Erreur : " + err.message, "danger");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
function showTab(tab) {
  const qaTab = document.getElementById("qaTab");
  const sumTab = document.getElementById("summariesTab");
  const btnQa = document.getElementById("tabBtnQa");
  const btnSum = document.getElementById("tabBtnSummaries");

  if (tab === "qa") {
    qaTab.classList.remove("hidden");
    sumTab.classList.add("hidden");
    btnQa.classList.add("bg-white", "text-slate-900", "shadow-sm");
    btnQa.classList.remove("text-slate-500");
    btnSum.classList.remove("bg-white", "text-slate-900", "shadow-sm");
    btnSum.classList.add("text-slate-500");
  } else {
    qaTab.classList.add("hidden");
    sumTab.classList.remove("hidden");
    btnSum.classList.add("bg-white", "text-slate-900", "shadow-sm");
    btnSum.classList.remove("text-slate-500");
    btnQa.classList.remove("bg-white", "text-slate-900", "shadow-sm");
    btnQa.classList.add("text-slate-500");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish / Library
// ─────────────────────────────────────────────────────────────────────────────
async function togglePublish() {
  if (!currentSessionId) return;
  if (!currentUser || currentUser.plan !== "premium") {
    showPaywall("premium_required");
    return;
  }
  try {
    const res = await apiFetch(`/sessions/${currentSessionId}/publish`, { method: "PATCH" });
    const data = await res.json();
    updatePublishBtn(data.is_public);
    if (currentSession) currentSession.is_public = data.is_public;
    showToast(data.is_public ? t("toast.shared") : t("toast.unshared"), "success");
  } catch (err) {
    if (err.message !== AUTH_ERROR && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

function updatePublishBtn(isPublic) {
  const btn = document.getElementById("publishBtn");
  const txt = document.getElementById("publishBtnText");
  if (!btn || !txt) return;
  if (isPublic) {
    btn.classList.remove("border-slate-200", "text-slate-600", "hover:bg-slate-100");
    btn.classList.add("border-violet-400", "text-violet-600", "bg-violet-50", "hover:bg-violet-100");
    txt.textContent = t("results.shared");
  } else {
    btn.classList.add("border-slate-200", "text-slate-600", "hover:bg-slate-100");
    btn.classList.remove("border-violet-400", "text-violet-600", "bg-violet-50", "hover:bg-violet-100");
    txt.textContent = t("results.share");
  }
}

function showLibrary() {
  if (!currentUser) {
    showAuthModal("login");
    return;
  }
  hideAll();
  document.getElementById("librarySection").classList.remove("hidden");
  loadLibrary();
}

async function loadLibrary() {
  const grid = document.getElementById("libraryGrid");
  grid.innerHTML = `<p class="text-slate-400 text-sm col-span-full text-center py-12">${t("library.loading")}</p>`;
  try {
    const res = await apiFetch("/library");
    const sessions = await res.json();
    if (!sessions.length) {
      grid.innerHTML = `<p class="text-slate-400 text-sm col-span-full text-center py-12">${t("library.empty")}</p>`;
      return;
    }
    const isPremium = currentUser && (currentUser.plan === "premium" || currentUser.is_admin);
    grid.innerHTML = sessions.map((s) => {
      const titleEsc = escHtml(s.title).replace(/'/g, "&#39;");
      const adminBadge = s.is_admin_deck
        ? `<span class="bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"><i class="bi bi-stars"></i>Officiel</span>`
        : "";
      const copyBtn = isPremium
        ? `<button onclick="copyLibrarySession(${s.id}, '${titleEsc}')"
            class="mt-auto w-full border border-violet-200 text-violet-600 hover:bg-violet-50 font-medium py-2 rounded-xl transition text-sm flex items-center justify-center gap-1.5">
            <i class="bi bi-copy"></i>${t("library.copy")}
           </button>`
        : `<button onclick="showPaywall('premium_required')"
            class="mt-auto w-full border border-slate-200 text-slate-400 hover:bg-slate-50 font-medium py-2 rounded-xl transition text-sm flex items-center justify-center gap-1.5 relative group">
            <i class="bi bi-lock-fill"></i>${t("library.copy")}
            <span class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">Premium requis</span>
           </button>`;
      return `
      <div class="bg-white rounded-2xl border ${s.is_admin_deck ? "border-amber-200" : "border-slate-200"} p-5 flex flex-col gap-3 hover:shadow-md transition ${s.is_admin_deck ? "hover:border-amber-300" : "hover:border-violet-200"}">
        <div>
          <div class="flex items-start justify-between gap-2 mb-1">
            <h3 class="font-semibold text-slate-900 text-sm leading-snug">${escHtml(s.title)}</h3>
            ${adminBadge}
          </div>
          <div class="flex items-center gap-1.5 flex-wrap mt-1">
            <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-1.5 py-0.5 rounded-md">${escHtml(s.subject || "Général")}</span>
          </div>
          <p class="text-slate-400 text-xs mt-1.5">${s.qa_count} ${t("library.qa")} · ${s.summary_count} ${t("library.summaries")} · ${formatDate(s.created_at)}</p>
          ${!s.is_admin_deck ? `<p class="text-slate-400 text-xs mt-0.5">${t("library.by")} ${escHtml(s.author_email)}</p>` : ""}
        </div>
        ${copyBtn}
      </div>`;
    }).join("");
  } catch (err) {
    if (err.message !== AUTH_ERROR && !err.message.includes("required")) {
      grid.innerHTML = `<p class="text-red-400 text-sm col-span-full text-center py-12">${t("library.error")}</p>`;
    }
  }
}

async function copyLibrarySession(id, title) {
  try {
    const res = await apiFetch(`/library/${id}/copy`, { method: "POST" });
    const data = await res.json();
    showToast(lang === "fr" ? `"${title}" copié dans ton compte !` : `"${title}" copied to your account!`, "success");
    await loadSessions();
    await loadAndShowSession(data.session_id);
  } catch (err) {
    if (err.message !== AUTH_ERROR && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!currentSessionId) return;
  window.location.href = `/export/${currentSessionId}/csv`;
}

function exportAnki() {
  if (!currentSessionId) return;
  if (!currentUser || currentUser.plan !== "premium") {
    showPaywall("premium_required");
    return;
  }
  window.location.href = `/export/${currentSessionId}/anki`;
}

function exportPDF() {
  if (!currentSessionId) return;
  if (!currentUser || currentUser.plan !== "premium") {
    showPaywall("premium_required");
    return;
  }
  window.location.href = `/export/${currentSessionId}/pdf`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section visibility helpers
// ─────────────────────────────────────────────────────────────────────────────
const ALL_SECTIONS = ["uploadSection", "loadingSection", "resultsSection", "practiceSection", "manualSection", "librarySection", "practiceSelectSection", "dashboardSection", "adminSection"];
function hideAll() { ALL_SECTIONS.forEach((id) => document.getElementById(id).classList.add("hidden")); }

function showLoading(msg = null) {
  const isUpload = !msg;
  msg = msg || t("loading.msg");
  hideAll();
  document.getElementById("loadingSection").classList.remove("hidden");
  document.getElementById("loadingMsg").textContent = msg;
  const waitEl = document.getElementById("loadingWait");
  if (waitEl) {
    const span = waitEl.querySelector("span");
    if (span) span.textContent = isUpload ? t("loading.wait") : "";
    waitEl.classList.toggle("hidden", !isUpload);
  }
}

function showResults() {
  hideAll();
  document.getElementById("resultsSection").classList.remove("hidden");
  // Hide free limit banner when switching sessions
  const banner = document.getElementById("freeLimitBanner");
  if (banner) banner.classList.add("hidden");
}

function showUpload() {
  hideAll();
  document.getElementById("uploadSection").classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function sanitizeMath(text) {
  return (text || "").replace(/\$\$?([\s\S]+?)\$?\$/g, (match, inner) => {
    if (/[àâäéèêëîïôùûüçœæÀÂÄÉÈÊËÎÏÔÙÛÜÇŒÆ]/.test(inner)) return inner;
    return match;
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(t("date.locale"), { day: "2-digit", month: "short", year: "numeric" });
}

function showToast(message, type = "info") {
  const id = "toast-" + Date.now();
  const colorMap = { success: "bg-green-500", danger: "bg-red-500", warning: "bg-yellow-500", info: "bg-sky-500" };
  const iconMap = { success: "check-circle-fill", danger: "exclamation-triangle-fill", warning: "exclamation-circle-fill", info: "info-circle-fill" };

  document.getElementById("toastContainer").insertAdjacentHTML("beforeend", `
    <div id="${id}" class="${colorMap[type] || "bg-sky-500"} text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-xs">
      <i class="bi bi-${iconMap[type] || "info-circle-fill"} shrink-0"></i>
      <span class="flex-1">${escHtml(message)}</span>
      <button onclick="this.parentElement.remove()" class="ml-2 text-white/70 hover:text-white transition">
        <i class="bi bi-x"></i>
      </button>
    </div>`);

  const el = document.getElementById(id);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice Mode
// ─────────────────────────────────────────────────────────────────────────────
let practiceQueue = [];
let practiceHistory = [];
let practiceTotal = 0;
let practiceCorrect = 0;
let practiceStreak = 0;
let practiceMaxStreak = 0;
let practiceSmartMode = false; // Mode Intelligent (Premium)

function startPractice() {
  if (!currentSession || !currentSession.qa_items.length) {
    showToast(t("toast.no.cards"), "warning");
    return;
  }
  practiceQueue = [...currentSession.qa_items].sort(() => Math.random() - 0.5);
  practiceHistory = [];
  practiceTotal = practiceQueue.length;
  practiceCorrect = 0;
  practiceStreak = 0;
  practiceMaxStreak = 0;

  hideAll();
  document.getElementById("practiceSection").classList.remove("hidden");
  document.getElementById("practiceEndScreen").classList.add("hidden");
  document.getElementById("practiceCardArea").classList.remove("hidden");
  renderPracticeCard();
}

// Calcule les prochains intervalles SM-2 côté client (pour affichage sur boutons)
function sm2Preview(card) {
  const ef = card.ease_factor || 2.5;
  const iv = card.interval || 0;
  const reps = card.review_count || 0;
  const again = 1;
  let hard, good, easy;
  if (reps === 0)      { hard = 1;  good = 1;  easy = 4; }
  else if (reps === 1) { hard = 3;  good = 6;  easy = 9; }
  else {
    hard = Math.max(iv + 1, Math.round(iv * 1.2));
    good = Math.round(iv * ef);
    easy = Math.round(iv * ef * 1.3);
  }
  return {
    again: Math.max(1, again),
    hard:  Math.max(1, hard),
    good:  Math.max(1, good),
    easy:  Math.max(1, easy),
  };
}

function renderPracticeCard() {
  const remaining = practiceQueue.length;
  const done = practiceTotal - remaining;
  const pct = (done / practiceTotal) * 100;

  document.getElementById("practiceProgress").textContent = t("practice.progress")(done, practiceTotal, remaining);
  document.getElementById("practiceProgressBar").style.width = pct + "%";

  if (!remaining) { endPractice(); return; }

  const card = practiceQueue[0];
  const iv = sm2Preview(card);
  const nx = (n) => t("practice.next")(n);

  const hasPrev = practiceHistory.length > 0;

  const smartBadge = practiceSmartMode
    ? `<span class="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><i class="bi bi-stars"></i>${t("practice.smart")}</span>`
    : "";

  document.getElementById("practiceCardArea").innerHTML = `
    <div class="practice-card">
      <!-- En-tête -->
      <div class="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between gap-1">
        <span style="color:#7c3aed" class="flex items-center gap-1"><i class="bi bi-question-circle"></i>${t("practice.question")}</span>
        <div class="flex items-center gap-2">
          ${smartBadge}
          ${hasPrev ? `<button onclick="goBackPractice()" class="text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition flex items-center gap-1 text-xs font-medium"><i class="bi bi-arrow-left"></i>${t("practice.prev")}</button>` : ""}
        </div>
      </div>

      <!-- Question -->
      <div class="text-base leading-relaxed flex-1 mb-4">${escHtml(sanitizeMath(card.question))}</div>

      <!-- Réponse cachée -->
      <div class="mb-4">
        <button id="practiceRevealBtn" onclick="togglePracticeAnswer()"
          class="text-xs text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition flex items-center gap-1 underline underline-offset-2">
          <i class="bi bi-eye"></i>${t("practice.see")}
        </button>
        <div id="practiceAnswerBox" class="hidden mt-2">
          <hr class="practice-divider mb-2" />
          <div class="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 text-green-600">
            <i class="bi bi-lightbulb"></i>${t("practice.answer")}
          </div>
          <div class="text-base leading-relaxed">${escHtml(sanitizeMath(card.answer))}</div>
        </div>
      </div>

      <!-- 4 boutons SM-2 — toujours visibles, sans labels de jours -->
      <div class="grid grid-cols-4 gap-1.5">
        <button onclick="answerPractice(1)"
          class="bg-red-500 hover:bg-red-600 active:scale-95 text-white font-semibold py-3 rounded-xl transition text-xs">
          ${t("practice.again")}
        </button>
        <button onclick="answerPractice(2)"
          class="bg-orange-400 hover:bg-orange-500 active:scale-95 text-white font-semibold py-3 rounded-xl transition text-xs">
          ${t("practice.hard")}
        </button>
        <button onclick="answerPractice(4)"
          class="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-semibold py-3 rounded-xl transition text-xs">
          ${t("practice.good")}
        </button>
        <button onclick="answerPractice(5)"
          class="bg-green-500 hover:bg-green-600 active:scale-95 text-white font-semibold py-3 rounded-xl transition text-xs">
          ${t("practice.easy")}
        </button>
      </div>
    </div>`;

  setTimeout(() => {
    if (window.renderMathInElement) {
      renderMathInElement(document.getElementById("practiceCardArea"), {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false, strict: false,
      });
    }
  }, 50);
}

function togglePracticeAnswer() {
  const box = document.getElementById("practiceAnswerBox");
  const revealBtn = document.getElementById("practiceRevealBtn");
  box.classList.remove("hidden");
  if (revealBtn) revealBtn.classList.add("hidden");
  if (window.renderMathInElement && !box.classList.contains("hidden")) {
    renderMathInElement(box, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false, strict: false,
    });
  }
}

function goBackPractice() {
  const prev = practiceHistory.pop();
  if (!prev) return;
  if (prev.wasCompleted) {
    // Re-insert the card at the front of the queue
    practiceQueue.unshift(prev.card);
    // Undo the correct count and streak
    practiceCorrect = Math.max(0, practiceCorrect - 1);
    practiceStreak = Math.max(0, practiceStreak - 1);
  } else {
    // Card was pushed to end of queue (quality=1), move it back to front
    const idx = practiceQueue.findLastIndex(c => c.id === prev.card.id);
    if (idx !== -1) practiceQueue.splice(idx, 1);
    practiceQueue.unshift(prev.card);
  }
  renderPracticeCard();
}

function answerPractice(quality) {
  const card = practiceQueue.shift();

  if (quality === 1) {
    practiceStreak = 0;
    practiceHistory.push({ card, wasCompleted: false });
    practiceQueue.push(card);
    if (practiceSmartMode) {
      _showSmartFeedback(card, quality, () => renderPracticeCard());
    } else {
      renderPracticeCard();
    }
  } else {
    practiceHistory.push({ card, wasCompleted: true });
    practiceCorrect++;
    practiceStreak++;
    if (practiceStreak > practiceMaxStreak) practiceMaxStreak = practiceStreak;
    apiFetch(`/qa/${card.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    }).then(r => r.json()).then(data => {
      if (data.xp_events) handleXPEvents(data.xp_events);
      if (currentSession) {
        const idx = currentSession.qa_items.findIndex(q => q.id === card.id);
        if (idx !== -1) currentSession.qa_items[idx] = { ...currentSession.qa_items[idx], ...data };
      }
    }).catch(() => {});

    if (practiceSmartMode) {
      _showSmartFeedback(card, quality, () => renderPracticeCard());
    } else {
      renderPracticeCard();
    }
  }
}

// Mode Intelligent : affiche la réponse + info révision 1.5s avant d'avancer
function _showSmartFeedback(card, quality, next) {
  const iv = sm2Preview(card);
  const intervals = { 1: iv.again, 2: iv.hard, 4: iv.good, 5: iv.easy };
  const days = intervals[quality] || 1;
  const colorMap = { 1: "bg-red-500", 2: "bg-orange-400", 4: "bg-blue-500", 5: "bg-green-500" };
  const labelMap = { 1: t("practice.again"), 2: t("practice.hard"), 4: t("practice.good"), 5: t("practice.easy") };
  const nextLabel = quality === 1
    ? t("practice.smart.again")
    : days === 1 ? t("practice.smart.tomorrow") : t("practice.smart.days")(days);

  document.getElementById("practiceCardArea").innerHTML = `
    <div class="practice-card flex flex-col gap-3">
      <div class="text-xs font-bold uppercase tracking-wider text-green-600 flex items-center gap-1">
        <i class="bi bi-lightbulb"></i>${t("practice.answer")}
      </div>
      <div class="text-base leading-relaxed flex-1">${escHtml(sanitizeMath(card.answer))}</div>
      <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <i class="bi bi-alarm"></i>${nextLabel}
        </span>
        <span class="text-xs font-bold text-white px-3 py-1 rounded-full ${colorMap[quality]}">${labelMap[quality]}</span>
      </div>
    </div>`;

  setTimeout(() => {
    if (window.renderMathInElement) {
      renderMathInElement(document.getElementById("practiceCardArea"), {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false, strict: false,
      });
    }
  }, 30);
  setTimeout(next, 1500);
}

function endPractice() {
  document.getElementById("practiceCardArea").classList.add("hidden");
  document.getElementById("practiceProgressBar").style.width = "100%";
  document.getElementById("practiceProgress").textContent = t("practice.cards")(practiceTotal);

  const pct = Math.round((practiceCorrect / practiceTotal) * 100);
  const emoji = pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📚";
  document.getElementById("practiceEndEmoji").textContent = emoji;
  document.getElementById("practiceEndStats").textContent = t("practice.end.stats")(practiceCorrect, practiceTotal, pct);
  document.getElementById("practiceEndScreen").classList.remove("hidden");

  // Send XP to server
  if (currentUser && practiceCorrect > 0) {
    apiFetch("/xp/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correct: practiceCorrect,
        total: practiceTotal,
        perfect: pct === 100,
        streak_10: practiceMaxStreak >= 10,
        streak_25: practiceMaxStreak >= 25,
      }),
    }).then(r => r.json()).then(handleXPEvents).catch(() => {});
  }
}

function closePractice() {
  document.getElementById("practiceSection").classList.add("hidden");
  if (currentSessionId) {
    document.getElementById("resultsSection").classList.remove("hidden");
    loadAndShowSession(currentSessionId);
  } else {
    showPracticeSelect();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm modal
// ─────────────────────────────────────────────────────────────────────────────
let confirmCallback = null;

function showConfirm(title, message, onOk) {
  confirmCallback = onOk;
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  document.getElementById("confirmModal").classList.remove("hidden");
  document.getElementById("confirmModal").classList.add("flex");
}

function confirmOk() {
  document.getElementById("confirmModal").classList.add("hidden");
  document.getElementById("confirmModal").classList.remove("flex");
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
}

function confirmCancel() {
  document.getElementById("confirmModal").classList.add("hidden");
  document.getElementById("confirmModal").classList.remove("flex");
  confirmCallback = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual mode
// ─────────────────────────────────────────────────────────────────────────────
function showManual() {
  hideAll();
  document.getElementById("manualSection").classList.remove("hidden");
}

async function createManualSession() {
  const title = document.getElementById("manualTitle").value.trim();
  const subject = getSubject("subjectInputManual") || "Général";
  if (!title) { showToast(t("toast.no.title"), "warning"); return; }

  const fd = new FormData();
  fd.append("title", title);
  fd.append("subject", subject);

  try {
    const res = await apiFetch("/sessions/manual", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { showToast("Erreur : " + data.detail, "danger"); return; }

    currentSessionId = data.session_id;
    await loadAndShowSession(currentSessionId);
    await loadSessions();
    if (data.xp_events) handleXPEvents(data.xp_events);
    showToast(t("toast.deck.created"), "success");
  } catch (err) {
    if (err.message !== AUTH_ERROR) showToast("Erreur : " + err.message, "danger");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Q/R Modal (add & edit)
// ─────────────────────────────────────────────────────────────────────────────
let qaModalMode = "add";
let qaModalEditId = null;

function openAddQaModal() {
  if (!currentSessionId) { showToast(t("toast.no.session"), "warning"); return; }
  qaModalMode = "add";
  qaModalEditId = null;
  document.getElementById("qaModalTitle").textContent = t("qa.add");
  document.getElementById("qaModalQuestion").value = "";
  document.getElementById("qaModalAnswer").value = "";
  document.getElementById("qaModal").classList.remove("hidden");
  document.getElementById("qaModal").classList.add("flex");
  document.getElementById("qaModalQuestion").focus();
}

function openEditQaModal(id, question, answer) {
  qaModalMode = "edit";
  qaModalEditId = id;
  document.getElementById("qaModalTitle").textContent = t("qa.edit");
  document.getElementById("qaModalQuestion").value = question;
  document.getElementById("qaModalAnswer").value = answer;
  document.getElementById("qaModal").classList.remove("hidden");
  document.getElementById("qaModal").classList.add("flex");
  document.getElementById("qaModalQuestion").focus();
}

function closeQaModal() {
  document.getElementById("qaModal").classList.add("hidden");
  document.getElementById("qaModal").classList.remove("flex");
}

async function submitQaModal() {
  const question = document.getElementById("qaModalQuestion").value.trim();
  const answer = document.getElementById("qaModalAnswer").value.trim();
  if (!question || !answer) { showToast(t("toast.fill.qa"), "warning"); return; }

  try {
    if (qaModalMode === "add") {
      const res = await apiFetch(`/sessions/${currentSessionId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (!res.ok) { showToast(t("error.add"), "danger"); return; }
      showToast(t("toast.added"), "success");
    } else {
      const res = await apiFetch(`/qa/${qaModalEditId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (!res.ok) { showToast(t("error.edit"), "danger"); return; }
      showToast(t("toast.edited"), "success");
    }
    closeQaModal();
    await loadAndShowSession(currentSessionId);
  } catch (err) {
    if (err.message !== AUTH_ERROR) showToast("Erreur : " + err.message, "danger");
  }
}

async function deleteQa(event, id) {
  event.stopPropagation();
  showConfirm(t("confirm.card.title"), t("confirm.irrev"), async () => {
    try {
      const res = await apiFetch(`/qa/${id}`, { method: "DELETE" });
      if (!res.ok) { showToast(t("error.delete"), "danger"); return; }
      showToast(t("toast.deleted.card"), "success");
      await loadAndShowSession(currentSessionId);
    } catch {}
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Gamification — XP / Level / Badges
// ─────────────────────────────────────────────────────────────────────────────
const XP_LEVELS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];

const BADGES_DEF = {
  // Révisions
  first_review:  { icon: "🎯", name: "Premier pas",     desc: "Première carte révisée" },
  reviewed_10:   { icon: "📚", name: "Studieux",         desc: "10 cartes révisées" },
  reviewed_50:   { icon: "🔥", name: "En feu",           desc: "50 cartes révisées" },
  reviewed_100:  { icon: "🏆", name: "Expert",           desc: "100 cartes révisées" },
  reviewed_200:  { icon: "🌟", name: "Assidu",           desc: "200 cartes révisées" },
  reviewed_500:  { icon: "🚀", name: "Inarrêtable",      desc: "500 cartes révisées" },
  reviewed_1000: { icon: "👑", name: "Légende",          desc: "1 000 cartes révisées" },
  // Decks
  creator:       { icon: "🎓", name: "Créateur",         desc: "Premier deck créé" },
  librarian:     { icon: "📖", name: "Bibliothécaire",   desc: "5 decks créés" },
  librarian_10:  { icon: "🗂️",  name: "Archiviste",       desc: "10 decks créés" },
  librarian_20:  { icon: "🏛️",  name: "Encyclopédiste",   desc: "20 decks créés" },
  shared:        { icon: "🌍", name: "Généreux",         desc: "Premier deck partagé" },
  // Practice
  perfect:       { icon: "💯", name: "Perfectionniste",  desc: "100 % à une session Practice" },
  perfect_3:     { icon: "🥇", name: "Champion",         desc: "3 sessions Practice parfaites" },
  streak_10:     { icon: "⚡", name: "Fulgurant",        desc: "10 bonnes réponses d'affilée" },
  streak_25:     { icon: "🌪️", name: "Tornade",          desc: "25 bonnes réponses d'affilée" },
  // Niveaux
  level_3:       { icon: "🥉", name: "Lancé",            desc: "Niveau 3 atteint" },
  level_5:       { icon: "⭐", name: "Étoile montante",  desc: "Niveau 5 atteint" },
  level_7:       { icon: "💫", name: "Brillant",         desc: "Niveau 7 atteint" },
  level_10:      { icon: "💎", name: "Maître",           desc: "Niveau 10 atteint" },
};

function updateXPWidget(user) {
  if (!user) return;
  const widget = document.getElementById("navXPWidget");
  const levelBadge = document.getElementById("navLevelBadge");
  const xpBar = document.getElementById("navXPBar");
  if (!widget) return;

  widget.classList.remove("hidden");
  widget.classList.add("flex");
  levelBadge.textContent = `Niv.${user.level}`;

  const xpCurrent = user.xp;
  const xpPrev = XP_LEVELS[Math.max(user.level - 2, 0)] || 0;
  const xpNext = user.xp_next;
  const pct = user.level >= 10 ? 100 : Math.round(((xpCurrent - xpPrev) / (xpNext - xpPrev)) * 100);
  xpBar.style.width = `${Math.min(pct, 100)}%`;

  // Sync mobile menu badges
  const mobileLevelBadge = document.getElementById("mobileNavLevelBadge");
  const mobilePlanBadge = document.getElementById("mobileNavPlanBadge");
  if (mobileLevelBadge) mobileLevelBadge.textContent = `Niv.${user.level}`;
  if (mobilePlanBadge) {
    if (user.plan === "premium") mobilePlanBadge.classList.remove("hidden");
    else mobilePlanBadge.classList.add("hidden");
  }
  // Sync mobile lang button
  const mobileLangBtn = document.getElementById("langToggleBtnMobile");
  const desktopLangBtn = document.getElementById("langToggleBtn");
  if (mobileLangBtn && desktopLangBtn) mobileLangBtn.innerHTML = desktopLangBtn.innerHTML;
}

function handleXPEvents(events) {
  if (!events) return;

  // Update local user state
  if (currentUser) {
    currentUser.xp = events.xp_total;
    currentUser.level = events.level;
    currentUser.xp_next = events.xp_next;
    if (events.new_badges?.length) {
      currentUser.badges = [...(currentUser.badges || []), ...events.new_badges.map(b => b.id)];
    }
    updateXPWidget(currentUser);
  }

  // Toast XP gain
  showXPToast(events.xp_gained);

  // Toast level up
  if (events.level_up) {
    setTimeout(() => showToast(`🎉 Niveau ${events.level} atteint !`, "success"), 800);
  }

  // Badge popup notifications
  if (events.new_badges?.length) {
    events.new_badges.forEach((badge, i) => {
      setTimeout(() => showBadgeNotif(badge), 1200 + i * 3500);
    });
  }
}

let _badgeNotifTimer = null;

function showBadgeNotif(badge) {
  const el = document.getElementById("badgeNotif");
  const icon = document.getElementById("badgeNotifIcon");
  const name = document.getElementById("badgeNotifName");
  const desc = document.getElementById("badgeNotifDesc");
  if (!el) return;

  icon.textContent = badge.icon;
  name.textContent = badge.name;
  desc.textContent = badge.desc;

  // Montrer
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";
  el.style.pointerEvents = "auto";

  if (_badgeNotifTimer) clearTimeout(_badgeNotifTimer);
  _badgeNotifTimer = setTimeout(() => hideBadgeNotif(), 4000);
}

function hideBadgeNotif() {
  const el = document.getElementById("badgeNotif");
  if (!el) return;
  el.style.opacity = "0";
  el.style.transform = "translateX(-50%) translateY(20px)";
  el.style.pointerEvents = "none";
}

function showXPToast(amount) {
  if (!amount) return;
  const id = "xp-toast-" + Date.now();
  document.getElementById("toastContainer").insertAdjacentHTML("beforeend", `
    <div id="${id}" class="bg-violet-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
      <i class="bi bi-stars shrink-0"></i>+${amount} XP
    </div>`);
  const el = document.getElementById(id);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s ease";
    el.style.opacity = "0";
    setTimeout(() => el?.remove(), 300);
  }, 2000);
}

// Badges modal
function showBadgesModal() {
  if (!currentUser) return;
  const earnedSet = new Set(currentUser.badges || []);
  const xp = currentUser.xp || 0;
  const level = currentUser.level || 1;
  const xpNext = currentUser.xp_next || 100;
  const xpPrev = XP_LEVELS[Math.max(level - 2, 0)] || 0;
  const pct = level >= 10 ? 100 : Math.round(((xp - xpPrev) / (xpNext - xpPrev)) * 100);

  document.getElementById("badgesModalTitle").textContent = `Niveau ${level}`;
  document.getElementById("badgesModalXP").textContent = `${xp} XP au total`;
  document.getElementById("badgesXPCurrent").textContent = `${xp} XP`;
  document.getElementById("badgesXPNext").textContent = level >= 10 ? "Niveau max !" : `${xpNext} XP pour le niveau suivant`;
  document.getElementById("badgesXPBarFull").style.width = `${Math.min(pct, 100)}%`;

  const earned = Object.entries(BADGES_DEF).filter(([id]) => earnedSet.has(id));
  const locked = Object.entries(BADGES_DEF).filter(([id]) => !earnedSet.has(id));

  document.getElementById("badgesSectionTitle").textContent = earned.length
    ? `Badges obtenus (${earned.length}/${Object.keys(BADGES_DEF).length})`
    : "Aucun badge encore";

  document.getElementById("badgesGrid").innerHTML = earned.length
    ? earned.map(([, b]) => `
        <div class="flex items-center gap-2.5 bg-violet-50 border border-violet-100 rounded-xl p-3">
          <span class="text-2xl">${b.icon}</span>
          <div>
            <div class="text-sm font-semibold text-slate-800">${b.name}</div>
            <div class="text-xs text-slate-400">${b.desc}</div>
          </div>
        </div>`).join("")
    : `<p class="text-slate-400 text-sm col-span-2">Révise des cartes pour gagner tes premiers badges !</p>`;

  document.getElementById("badgesLockedTitle").textContent = locked.length ? `À débloquer (${locked.length})` : "";
  document.getElementById("badgesLockedGrid").innerHTML = locked.map(([, b]) => `
    <div class="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl p-3 opacity-50">
      <span class="text-2xl grayscale">${b.icon}</span>
      <div>
        <div class="text-sm font-semibold text-slate-500">${b.name}</div>
        <div class="text-xs text-slate-400">${b.desc}</div>
      </div>
    </div>`).join("");

  document.getElementById("badgesModal").classList.remove("hidden");
  document.getElementById("badgesModal").classList.add("flex");
}

function hideBadgesModal() {
  document.getElementById("badgesModal").classList.add("hidden");
  document.getElementById("badgesModal").classList.remove("flex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Export dropdown
// ─────────────────────────────────────────────────────────────────────────────
function toggleExportMenu() {
  const menu = document.getElementById("exportMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
  if (!menu.classList.contains("hidden")) {
    const close = (e) => {
      if (!document.getElementById("exportMenuWrap")?.contains(e.target)) {
        menu.classList.add("hidden");
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
let _chartReviews = null;
let _chartXP = null;

function showDashboard() {
  if (!currentUser) { showAuthModal("login"); return; }
  hideAll();
  document.getElementById("dashboardSection").classList.remove("hidden");
  loadDashboard();
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────
async function showAdmin() {
  if (!currentUser?.is_admin) return;
  hideAll();
  document.getElementById("adminSection").classList.remove("hidden");

  try {
    const data = await apiFetch("/admin/stats");
    document.getElementById("adminTotalUsers").textContent    = data.total_users;
    document.getElementById("adminPremiumUsers").textContent  = data.premium_users;
    document.getElementById("adminFreeUsers").textContent     = data.free_users;
    document.getElementById("adminNewUsersWeek").textContent  = "+" + data.new_users_week;
    document.getElementById("adminNewUsersMonth").textContent = "+" + data.new_users_month;
    document.getElementById("adminTotalSessions").textContent = data.total_sessions;
    document.getElementById("adminNewSessionsWeek").textContent = "+" + data.new_sessions_week;
    document.getElementById("adminTotalCards").textContent    = data.total_cards;
    document.getElementById("adminTotalReviews").textContent  = data.total_reviews;

    const list = document.getElementById("adminRecentUsers");
    list.innerHTML = data.recent_users.map(u => `
      <div class="flex items-center justify-between py-1.5 border-b last:border-0" style="border-color:var(--border)">
        <span>${u.email}</span>
        <span class="text-xs" style="color:var(--text-muted)">${u.created_at}</span>
      </div>`).join("");
  } catch {
    showToast("Erreur lors du chargement des stats.", "error");
  }
}

async function loadDashboard() {
  document.getElementById("dashKpis").innerHTML = `
    <div class="stat-card col-span-2 md:col-span-4 text-center text-slate-400 text-sm py-6">
      <span class="inline-block w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mr-2"></span>Chargement…
    </div>`;
  try {
    const res = await apiFetch("/stats/dashboard");
    const data = await res.json();
    _renderDashboard(data);
  } catch (err) {
    if (err.message !== AUTH_ERROR) {
      document.getElementById("dashKpis").innerHTML = `<p class="text-red-400 text-sm col-span-4">${t("library.error")}</p>`;
    }
  }
}

function _renderDashboard(data) {
  const { kpis, reviews_per_day, xp_over_time, subjects, due_by_deck, is_premium } = data;

  // KPIs
  const kpiDefs = [
    { key: "total_cards", label: t("dashboard.kpi.cards"), icon: "bi-card-text", color: "text-violet-600" },
    { key: "total_decks", label: t("dashboard.kpi.decks"), icon: "bi-collection", color: "text-sky-500" },
    { key: "total_reviews", label: t("dashboard.kpi.reviews"), icon: "bi-check2-all", color: "text-emerald-500" },
    { key: "due_count", label: t("dashboard.kpi.due"), icon: "bi-alarm", color: "text-amber-500" },
  ];
  document.getElementById("dashKpis").innerHTML = kpiDefs.map(({ key, label, icon, color }) => `
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none ${color}">${kpis[key] ?? 0}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5 flex items-center gap-1"><i class="bi ${icon}"></i>${label}</div>
    </div>`).join("");

  // Blur overlay
  const overlay = document.getElementById("dashBlurOverlay");
  if (overlay) {
    if (is_premium) { overlay.classList.add("hidden"); overlay.classList.remove("flex"); }
    else { overlay.classList.remove("hidden"); overlay.classList.add("flex"); }
  }

  // Charts
  _drawChart("chartReviews", _chartReviews, reviews_per_day, "date", "count", "#7c3aed", t("dashboard.chart.reviews"),
    (c) => { _chartReviews = c; });
  _drawChart("chartXP", _chartXP, xp_over_time, "date", "xp", "#06b6d4", t("dashboard.chart.xp"),
    (c) => { _chartXP = c; });

  // Subjects breakdown
  const total_cards = kpis.total_cards || 1;
  const dashSubjects = document.getElementById("dashSubjects");
  if (!subjects.length) {
    dashSubjects.innerHTML = `<p class="text-slate-400 text-sm">${t("dashboard.no_data")}</p>`;
  } else {
    dashSubjects.innerHTML = subjects.sort((a, b) => b.cards - a.cards).map((s) => {
      const pct = Math.round((s.cards / total_cards) * 100);
      return `
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="font-medium text-slate-700">${escHtml(s.name)}</span>
            <span class="text-slate-400">${s.cards} cartes · ${s.due} à réviser</span>
          </div>
          <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-violet-500 rounded-full" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join("");
  }

  // Due by deck
  const dashDue = document.getElementById("dashDue");
  if (!due_by_deck.length) {
    dashDue.innerHTML = `<p class="text-slate-400 text-sm">${t("dashboard.no_data")}</p>`;
  } else {
    dashDue.innerHTML = due_by_deck.map((d) => {
      const pct = d.total ? Math.round((d.due / d.total) * 100) : 0;
      const color = d.due === 0 ? "bg-emerald-400" : d.due < 5 ? "bg-amber-400" : "bg-red-400";
      return `
        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-700 truncate">${escHtml(d.title)}</span>
              <span class="text-slate-400 shrink-0 ml-2">${d.due} / ${d.total}</span>
            </div>
            <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full ${color} rounded-full" style="width:${pct}%"></div>
            </div>
          </div>
        </div>`;
    }).join("");
  }
}

function _drawChart(canvasId, existing, data, xKey, yKey, color, label, setRef) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (existing) { existing.destroy(); }
  if (!data.length) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("dashboard.no_data"), canvas.width / 2, 70);
    setRef(null);
    return;
  }
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((d) => d[xKey]),
      datasets: [{
        label,
        data: data.map((d) => d[yKey]),
        borderColor: color,
        backgroundColor: color + "22",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 6, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { font: { size: 11 } }, beginAtZero: true },
      },
    },
  });
  setRef(chart);
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice Select Mode
// ─────────────────────────────────────────────────────────────────────────────
function showPracticeSelect() {
  if (!currentUser) { showAuthModal("login"); return; }
  if (!_lastSessions.length) { showToast(t("toast.no.cards"), "warning"); return; }
  hideAll();
  document.getElementById("practiceSelectSection").classList.remove("hidden");
  document.getElementById("dueOnlyToggle").checked = false;
  const smartToggle = document.getElementById("smartModeToggle");
  if (smartToggle) smartToggle.checked = false;
  practiceSmartMode = false;
  renderPracticeSelectList();
}

function renderPracticeSelectList() {
  const dueOnly = document.getElementById("dueOnlyToggle")?.checked || false;
  const list = document.getElementById("practiceSelectList");
  if (!list) return;

  // Preserve current selections before re-render
  const prevSelected = new Set(
    [...document.querySelectorAll(".practice-select-cb:checked")].map(cb => cb.value)
  );

  // Group sessions by subject
  const bySubject = {};
  _lastSessions.forEach((s) => {
    const subj = s.subject || "Général";
    if (!bySubject[subj]) bySubject[subj] = [];
    bySubject[subj].push(s);
  });

  if (!_lastSessions.length) {
    list.innerHTML = `<p class="text-slate-400 text-sm text-center py-8">${t("practiceselect.empty")}</p>`;
    _updatePracticeCount();
    return;
  }

  // If nothing was selected yet (first render), select all by default
  const isFirstRender = prevSelected.size === 0;

  list.innerHTML = Object.entries(bySubject).map(([subject, sessions]) => {
    const cards = sessions.map((s) => {
      const count = dueOnly ? s.due_count : s.qa_count;
      const disabled = count === 0 && dueOnly;
      // Restore previous selection, or select all on first render
      const checked = !disabled && (isFirstRender || prevSelected.has(String(s.id)));
      const dueLabel = s.due_count > 0
        ? `<span class="ml-1 text-amber-600 text-xs font-medium">(${s.due_count} ${t("practiceselect.due")})</span>`
        : "";
      return `
        <label class="flex items-center gap-3 p-3 hover:bg-violet-50 rounded-xl cursor-pointer transition group ${disabled ? "opacity-40 pointer-events-none" : ""}">
          <input type="checkbox" class="practice-select-cb rounded accent-violet-600 shrink-0" value="${s.id}"
            ${disabled ? "disabled" : ""}
            ${checked ? "checked" : ""}
            onchange="_updatePracticeCount()" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-800 truncate">${escHtml(s.title)}</div>
            <div class="text-xs text-slate-400">${s.qa_count} cartes${dueLabel}</div>
          </div>
        </label>`;
    }).join("");

    return `
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-2 py-0.5 rounded-md">${escHtml(subject)}</span>
        </div>
        <div class="divide-y divide-slate-50">${cards}</div>
      </div>`;
  }).join("");

  _updatePracticeCount();
}

function _updatePracticeCount() {
  const dueOnly = document.getElementById("dueOnlyToggle")?.checked || false;
  const checked = [...document.querySelectorAll(".practice-select-cb:checked")];
  const selectedIds = checked.map((cb) => parseInt(cb.value));
  const total = _lastSessions
    .filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + (dueOnly ? s.due_count : s.qa_count), 0);
  const el = document.getElementById("practiceSelectCount");
  if (el) el.textContent = t("practiceselect.cards")(total);
}

function practiceSelectAll(select) {
  document.querySelectorAll(".practice-select-cb:not(:disabled)").forEach((cb) => {
    cb.checked = select;
  });
  _updatePracticeCount();
}

async function startAllDuePractice() {
  const ids = _lastSessions.filter(s => s.due_count > 0).map(s => s.id);
  if (!ids.length) { showToast(t("toast.no.cards"), "warning"); return; }
  showLoading();
  try {
    const res = await apiFetch(`/practice/cards?sessions=${ids.join(",")}&due_only=true`);
    const cards = await res.json();
    if (!cards.length) { showToast(t("toast.no.cards"), "warning"); showUpload(); return; }
    practiceQueue = cards.sort(() => Math.random() - 0.5);
    practiceHistory = [];
    practiceTotal = practiceQueue.length;
    practiceCorrect = 0;
    practiceStreak = 0;
    practiceMaxStreak = 0;
    currentSessionId = null;
    currentSession = null;
    hideAll();
    document.getElementById("practiceSection").classList.remove("hidden");
    document.getElementById("practiceEndScreen").classList.add("hidden");
    document.getElementById("practiceCardArea").classList.remove("hidden");
    renderPracticeCard();
  } catch { showUpload(); }
}

function toggleSmartMode(e) {
  if (!currentUser?.is_premium) {
    e.preventDefault();
    showPaywall("premium_required");
    return false;
  }
}

async function startMultiPractice() {
  const dueOnly = document.getElementById("dueOnlyToggle")?.checked || false;
  practiceSmartMode = !!(currentUser?.is_premium && document.getElementById("smartModeToggle")?.checked);
  const checked = [...document.querySelectorAll(".practice-select-cb:checked")];
  if (!checked.length) { showToast(t("practiceselect.no_selection"), "warning"); return; }

  const ids = checked.map((cb) => cb.value).join(",");
  showLoading();
  try {
    const res = await apiFetch(`/practice/cards?sessions=${ids}&due_only=${dueOnly}`);
    const cards = await res.json();
    if (!cards.length) { showToast(t("toast.no.cards"), "warning"); showPracticeSelect(); return; }

    // Launch practice with these cards
    practiceQueue = cards.sort(() => Math.random() - 0.5);
    practiceHistory = [];
    practiceTotal = practiceQueue.length;
    practiceCorrect = 0;
    practiceStreak = 0;
    practiceMaxStreak = 0;

    hideAll();
    document.getElementById("practiceSection").classList.remove("hidden");
    document.getElementById("practiceEndScreen").classList.add("hidden");
    document.getElementById("practiceCardArea").classList.remove("hidden");
    renderPracticeCard();
  } catch (err) {
    showPracticeSelect();
    if (err.message !== AUTH_ERROR) showToast("Erreur : " + err.message, "danger");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expose to inline onclick handlers
// ─────────────────────────────────────────────────────────────────────────────
window.handleUpload = handleUpload;
window.loadSessions = loadSessions;
window.loadAndShowSession = loadAndShowSession;
window.deleteSession = deleteSession;
window.startRenameSession = startRenameSession;
window.flipCard = flipCard;
window.markReviewed = markReviewed;
window.showTab = showTab;
window.exportCSV = exportCSV;
window.exportAnki = exportAnki;
window.exportPDF = exportPDF;
window.showUpload = showUpload;
window.showManual = showManual;
window.startPractice = startPractice;
window.startAllDuePractice = startAllDuePractice;
window.renderPracticeCard = renderPracticeCard;
window.togglePracticeAnswer = togglePracticeAnswer;
window.answerPractice = answerPractice;
window.goBackPractice = goBackPractice;
window.closePractice = closePractice;
window.confirmOk = confirmOk;
window.confirmCancel = confirmCancel;
window.createManualSession = createManualSession;
window.openAddQaModal = openAddQaModal;
window.openEditQaModal = openEditQaModal;
window.closeQaModal = closeQaModal;
window.submitQaModal = submitQaModal;
window.deleteQa = deleteQa;
window.showAuthModal = showAuthModal;
window.hideAuthModal = hideAuthModal;
window.switchAuthTab = switchAuthTab;
window.submitAuth = submitAuth;
window.logout = logout;
window.showPaywall = showPaywall;
window.closePaywall = closePaywall;
window.subscribePremium = subscribePremium;
window.manageSubscription = manageSubscription;
window.buyCredits = buyCredits;
// ─────────────────────────────────────────────────────────────────────────────
// Dark mode
// ─────────────────────────────────────────────────────────────────────────────
function updateDarkModeIcon() {
  const icon = document.getElementById("darkModeIcon");
  if (!icon) return;
  const isDark = document.documentElement.classList.contains("dark");
  icon.className = isDark ? "bi bi-sun-fill text-sm" : "bi bi-moon-fill text-sm";
}

function initDarkMode() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  updateDarkModeIcon();
}

function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  const isDark = document.documentElement.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateDarkModeIcon();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile menu (legacy stubs — menu replaced by dual navbar)
// ─────────────────────────────────────────────────────────────────────────────
function closeMobileMenu() {
}

window.showUpgrade = showUpgrade;
window.showLibrary = showLibrary;
window.loadLibrary = loadLibrary;
window.copyLibrarySession = copyLibrarySession;
window.togglePublish = togglePublish;
window.toggleLang = toggleLang;
window.showBadgesModal = showBadgesModal;
window.hideBadgesModal = hideBadgesModal;
window.showForgotModal = showForgotModal;
window.hideForgotModal = hideForgotModal;
window.submitForgotPassword = submitForgotPassword;
window.submitResetPassword = submitResetPassword;
window.showLegal = showLegal;
window.hideLegal = hideLegal;
window.showContact = showContact;
window.hideContact = hideContact;
window.handleGoogleCredential = handleGoogleCredential;
window.showDashboard = showDashboard;
window.showAdmin = showAdmin;
window.toggleExportMenu = toggleExportMenu;
window.showPracticeSelect = showPracticeSelect;
window.renderPracticeSelectList = renderPracticeSelectList;
window.practiceSelectAll = practiceSelectAll;
window.toggleSmartMode = toggleSmartMode;
window.startMultiPractice = startMultiPractice;
window._updatePracticeCount = _updatePracticeCount;
window.toggleDarkMode = toggleDarkMode;
window.closeMobileMenu = closeMobileMenu;

// ─────────────────────────────────────────────────────────────────────────────
// Init — check auth before showing anything
// ─────────────────────────────────────────────────────────────────────────────
async function initApp() {
  inject();
  // Init dark mode before anything renders
  initDarkMode();

  // Handle Stripe return params
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset_token")) {
    const token = params.get("reset_token");
    history.replaceState({}, "", "/");
    showResetModal(token);
  } else if (params.has("subscribed")) {
    history.replaceState({}, "", "/");
    showToast(t("toast.premium"), "success");
  } else if (params.has("credits")) {
    history.replaceState({}, "", "/");
    showToast(t("toast.credits.added"), "success");
  }

  // Apply i18n immediately
  applyTranslations();

  // Show navbar buttons immediately (logged-out state) — updateNavbar() again after auth check
  updateNavbar();

  // Always show the upload page immediately
  showUpload();

  // Load Google client_id and init GSI (non-blocking)
  fetch(API_BASE + "/auth/google-client-id")
    .then((r) => r.json())
    .then(({ client_id }) => {
      if (!client_id) {
        console.warn("[Google] client_id manquant — GOOGLE_CLIENT_ID non configuré ?");
        return;
      }
      const wrap = document.getElementById("googleSignInWrap");
      window.__GOOGLE_CLIENT_ID__ = client_id;
      console.log("[Google] client_id chargé ✓");
      // If GSI already loaded, init now; otherwise wait for onload
      if (window.google?.accounts?.id) {
        _initGoogleSignIn();
      } else {
        // GSI script calls window.onGoogleLibraryLoad if defined
        window.onGoogleLibraryLoad = _initGoogleSignIn;
      }
      if (wrap) wrap.classList.remove("hidden");
    })
    .catch(() => {
      const wrap = document.getElementById("googleSignInWrap");
      if (wrap) wrap.classList.add("hidden");
    });

  // Check auth silently in the background
  try {
    const res = await fetch(API_BASE + "/auth/me", { credentials: "include" });
    if (res.ok) {
      currentUser = await res.json();
      updateNavbar();
      await loadSessions();
    } else {
      updateNavbar();
    }
  } catch {
    updateNavbar();
  }
}

initApp();
