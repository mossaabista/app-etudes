# PROMPT MAÎTRE POUR CLAUDE CODE — Faire évoluer AURUM sans casser l’existant

> **Comment l’utiliser :** ouvre Claude Code à la racine du dépôt AURUM, vérifie que le bon projet est ouvert, puis colle tout ce prompt. Il est volontairement orienté audit + implémentation progressive. Ne demande pas à Claude de tout reconstruire d’un seul coup.

---

## TON RÔLE

Tu es le principal architecte logiciel, ingénieur full-stack senior, concepteur produit, spécialiste UX/UI et ingénieur d’agents IA chargé de faire évoluer **AURUM**, une application de gestion intelligente des tâches et des domaines de vie.

Tu dois travailler **directement dans le dépôt existant**. Tu ne pars pas d’une application vide et tu ne remplaces pas arbitrairement la stack. Ton travail est de comprendre ce qui est déjà construit, de préserver les fonctionnalités correctes, de réparer les flux incomplets, puis d’ajouter de vraies capacités opérationnelles.

Tu n’es pas ici pour produire seulement un rapport, un prototype visuel, un long plan ou des boutons factices. Tu dois auditer, décider, implémenter, vérifier et documenter, par étapes sûres.

## VISION DU PRODUIT

AURUM doit devenir un **assistant personnel et professionnel d’organisation, piloté par intention**, qui aide différents types d’utilisateurs à gérer leurs engagements dans un seul endroit.

L’utilisateur peut écrire ou parler naturellement :

- « Ajoute une séance de sport samedi à 10 h. »
- « Organise mon semestre à partir de mes syllabus. »
- « Crée un espace pour mon nouveau projet, avec les dossiers, les tâches de départ et un calendrier. »
- « J’ai un examen mardi et trois livrables cette semaine. Fais-moi un plan réaliste. »
- « Déplace les tâches non urgentes, mais ne touche pas à mes cours et à mes réunions confirmées. »
- « Qu’est-ce qui risque de ne pas être terminé à temps ? »
- « Prépare mon espace de travail pour mon entreprise / mon entraînement / mes études. »

L’assistant ne doit pas simplement raconter comment effectuer ces actions. Il doit planifier les opérations, appeler les fonctions réelles de l’application, vérifier les résultats, puis rendre compte clairement de ce qui a été effectué, de ce qui a échoué et de ce qui nécessite mon accord.

La promesse produit est : **« Dis à AURUM ce que tu veux accomplir. Il transforme ton intention en une organisation concrète, adaptée à ta vie, et vérifie que le travail est réellement fait. »**

## CONTEXTE VISUEL ET FONCTIONNEL À PRÉSERVER

L’application visible actuellement porte le nom **AURUM**. L’interface existante a une identité sombre, chaude, dorée et relativement immersive. La vidéo de démonstration montre notamment :

- Une barre latérale avec « Aujourd’hui », « Calendrier », « Cours », « Secteurs » et « Réglages ».
- Une page Aujourd’hui avec un élément de type « Pilote », des tâches à rendre et une action de planification de journée.
- Un espace Cours avec des cours comme CHM1711, des éléments associés aux cours, des échéances et une zone d’import du syllabus.
- Un Calendrier qui présente des événements et/ou tâches répartis sur les jours.
- Une section Secteurs avec des domaines comme Corps, Sport, Nutrition et Sommeil, avec des valeurs ou indicateurs de suivi.
- Une interface d’assistant et un mode vocal qui affiche un état d’écoute et une zone de conversation.
- Des réglages de profil offrant au moins des orientations telles qu’Étudiant, Professionnel et Entrepreneur, ainsi que des cartes ou catégories de tâches/modules.

Ces observations sont une référence UX, **pas une preuve de la façon dont le code est implémenté**. Le dépôt, les données, les routes et les composants existants font foi. Inspecte le projet pour connaître les comportements réellement opérationnels.

### Règles impératives de conservation

1. Ne supprime pas de fonctionnalité existante qui fonctionne simplement parce qu’une nouvelle structure te semble plus élégante.
2. Ne remplace pas la stack technique, la base de données, le système d’authentification, le routeur ou les composants majeurs sans démontrer un problème réel et proposer une migration compatible.
3. Ne réécris pas le projet entier en une seule opération.
4. Ne transforme pas des fonctions réelles en démonstrations simulées. Ne crée pas de fausses données de réussite pour masquer une API ou une base de données non connectée.
5. Fais de petites modifications cohérentes, réutilise les composants existants quand c’est pertinent et ajoute des migrations réversibles.
6. Conserve les dossiers, tâches, cours, préférences et historiques existants. Un changement de profil doit modifier les modules visibles, pas effacer les données.
7. Avant de modifier un flux critique, identifie son implémentation, ses dépendances, ses tests et les risques de régression.
8. Si une fonctionnalité dépend d’une clé API ou d’un service absent, construis une intégration propre avec un message d’état honnête. Ne prétends pas que la fonction est connectée.

---

# PARTIE I — AUDIT AVANT MODIFICATION

## 1. Cartographier le dépôt

Commence par inspecter méthodiquement :

- Le framework, les versions, les scripts, la structure du projet et les dépendances.
- Le routeur, les pages, les layouts, les composants visuels, les thèmes et le responsive.
- La base de données, le schéma, les modèles, les migrations, les méthodes d’accès aux données et les données de démonstration éventuelles.
- L’authentification, l’autorisation, les profils utilisateurs et l’isolation des données.
- Les API routes, server actions, services, jobs en arrière-plan, intégrations externes et variables d’environnement.
- L’IA existante : fournisseur, modèle, prompts système, parsing de sortie, outils/fonctions disponibles, mémoire, historique, flux vocal et gestion des erreurs.
- Le calendrier, les tâches, les dossiers, les projets, les cours, les secteurs, les indicateurs corporels/nutritionnels et les paramètres de profil.
- Les tests, les journaux, les problèmes connus et les erreurs de compilation/types/lint.

Lance les commandes non destructives qui permettent de comprendre et d’évaluer l’état initial : tests, lint, vérification TypeScript, build si possible. Note les erreurs préexistantes avant de commencer, pour ne pas les confondre avec les régressions introduites.

## 2. Construire une matrice d’état

Pour chaque flux important, classe son état :

- **Fonctionnel** : interface, logique serveur et persistance fonctionnent et ont été vérifiées.
- **Partiellement fonctionnel** : l’interface existe mais un maillon manque.
- **Visuel uniquement** : une carte, un bouton ou une conversation est présent sans action persistée.
- **Défaillant** : erreur connue, comportement incohérent ou données mal synchronisées.
- **Non implémenté** : la capacité n’existe pas encore.

Vérifie au minimum : création/modification/suppression des tâches, création de dossiers, liens entre dossiers et tâches, création d’événements, calendrier, import de syllabus, navigation entre profils, sauvegarde des réglages et actions par la voix. Ne déclare pas un flux fonctionnel sur la seule base de son apparence.

## 3. Établir un point de référence sûr

- Identifie comment le projet est lancé et comment les tests sont exécutés.
- Vérifie Git et le statut des modifications de l’utilisateur. **Ne réinitialise, ne stash, ne supprime et n’écrase jamais ses changements sans autorisation.**
- Ne lance aucune commande destructive sur la base de données de développement ou de production.
- Si possible, crée un commit ou un point de restauration uniquement après avoir vérifié le statut et sans inclure de secrets ni de modifications étrangères au travail.
- Fais une courte liste des risques et du plan d’implémentation, puis commence immédiatement par le premier lot de travail utile. Ne t’arrête pas après avoir écrit le plan.

---

# PARTIE II — ARCHITECTURE PRODUIT

## 4. Séparer trois concepts : utilisateur, profil et secteur

Ne mélange pas ces notions.

### A. Profil / rôle

Le profil détermine les modules et les modèles proposés par défaut. Prévoir une architecture extensible pour, au minimum :

- Étudiant
- Professionnel / employé
- Entrepreneur / dirigeant
- Sportif / coach
- Freelance / créateur
- Personnel / quotidien

Un utilisateur peut cumuler plusieurs rôles et changer de contexte actif. Ne crée pas un compte différent pour chaque rôle.

### B. Secteurs / domaines de vie

Les secteurs sont des domaines transversaux qui peuvent exister pour tous les profils, par exemple : Santé, Corps, Sport, Nutrition, Sommeil, Habitudes, Finances personnelles (si déjà prévues), Maison, Relations, Apprentissage et Développement personnel.

Ne force pas chaque utilisateur à activer chaque secteur. L’utilisateur doit pouvoir en ajouter, renommer, réordonner, masquer ou archiver, avec une confirmation avant tout archivage de données.

### C. Modules de travail

Les modules regroupent les objets nécessaires à un rôle : cours, laboratoires, examens, réunions, clients, équipes, séances d’entraînement, livrables, etc. Les modules doivent exploiter les mêmes primitives de tâches, calendrier, fichiers, projets, rappels et objectifs quand c’est logique, plutôt que de créer des implémentations indépendantes et difficiles à maintenir.

## 5. Barre latérale dynamique sans perdre la navigation commune

Garde une base de navigation cohérente, puis affiche les modules pertinents selon les profils et les préférences.

Exemple Étudiant : Aujourd’hui, Inbox/Capture, Calendrier, Tâches, Cours, Devoirs et examens, Laboratoires, Projets, Plan d’étude, Documents, Secteurs, Assistant, Réglages.

Exemple Professionnel : Aujourd’hui, Inbox, Calendrier, Tâches, Projets, Réunions, Équipe, Clients ou parties prenantes si applicables, Livrables, Documents, Secteurs, Assistant, Réglages.

Exemple Sportif : Aujourd’hui, Calendrier, Entraînement, Programmes, Exercices, Récupération, Nutrition, Mesures et progrès, Objectifs, Assistant, Réglages.

Ces listes sont des modèles initiaux, pas des menus obligatoires. L’utilisateur doit pouvoir personnaliser sa navigation. Il doit toujours comprendre où il se trouve et retrouver ses données même s’il modifie son profil.

### À implémenter proprement

- Un registre de modules et des définitions de profil, pas des conditions éparpillées dans tous les composants.
- Des préférences enregistrées côté persistance et chargées après connexion.
- Un état de navigation actif prévisible.
- Une gestion des modules activés/désactivés, personnalisés et épinglés.
- Une stratégie de compatibilité avec les utilisateurs existants : migrations par défaut sûres, sans écraser les choix enregistrés.
- Un affichage mobile qui ne nécessite pas une barre latérale desktop complète.

## 6. Objets de données et relations

Pars du schéma actuel et évite les duplications. Si le schéma a besoin d’évoluer, propose et ajoute des migrations compatibles. Les entités génériques peuvent comprendre, selon les modèles existants :

- User / UserSettings / UserProfile / ProfileModulePreference
- Sector / Module / Workspace
- Folder ou Collection, avec parent optionnel pour l’imbrication
- Project / Goal / Task / Subtask / ChecklistItem
- Course / CourseMaterial / SyllabusImport / ExtractedItem
- Event / Calendar / RecurrenceRule / AvailabilityRule
- Attachment / SourceReference / Reminder
- Habit / Routine / Metric / MetricEntry
- AgentConversation / AgentMessage / AgentAction / ActionResult / AuditEvent
- IntegrationConnection / PermissionGrant / AutomationRule

N’ajoute pas mécaniquement toutes ces tables si l’équivalent existe déjà. Commence par mapper le modèle actuel. Évite le « god object » qui contiendrait tous les champs de toutes les spécialités. Utilise des relations explicites, des types validés et, si nécessaire, des métadonnées structurées sans transformer toute la base en JSON opaque.

Chaque ressource doit être reliée au bon propriétaire / espace et son accès validé côté serveur. Le modèle IA ne doit jamais pouvoir accéder à des données d’un autre utilisateur en fournissant simplement un identifiant différent.

---

# PARTIE III — FAIRE DE L’IA UN AGENT QUI EXÉCUTE

## 7. Principe fondamental

**Le modèle ne modifie pas directement la base.** Il interprète la demande et propose des appels d’outils structurés. Le serveur valide les arguments, les permissions, les règles métier et le propriétaire des ressources, exécute l’action, puis renvoie un résultat réel à l’agent.

Construis ou améliore un agent avec une boucle explicite :

1. Comprendre la demande, la langue, la date, le contexte actif et l’historique pertinent.
2. Déterminer le résultat voulu et les informations manquantes.
3. Récupérer les données existantes nécessaires pour éviter les doublons ou conflits.
4. Préparer un plan d’action structuré et évaluer son risque.
5. Demander une clarification seulement si une ambiguïté importante empêche une action fiable.
6. Obtenir une confirmation pour les opérations qui le nécessitent.
7. Exécuter les appels d’outils autorisés côté serveur.
8. Vérifier la réponse de la base ou du service externe, sans se fier à l’intention du modèle.
9. Présenter un compte rendu précis des succès, échecs et actions en attente.
10. Enregistrer l’historique nécessaire pour permettre le suivi et, lorsque possible, l’annulation.

Ne simule pas la boucle en demandant au modèle de répondre « c’est fait ». Une action n’est réussie que lorsqu’un retour fiable du service l’atteste.

## 8. Registre d’outils typés

Définis des fonctions atomiques, réutilisables et décrites clairement. Adapte les noms à la stack actuelle. Les familles d’outils devraient couvrir :

### Lecture / recherche

- `search_tasks`, `get_task`, `list_tasks`, `get_today_overview`
- `search_projects`, `list_folders`, `get_workspace_structure`
- `get_calendar_events`, `get_availability`, `find_schedule_conflicts`
- `list_courses`, `get_course_details`, `list_deadlines`
- `search_documents`, `get_document_sources`
- `get_user_preferences`, `get_enabled_modules`, `get_current_context`
- `get_metrics_summary`, `get_habits`, selon les modules activés

### Tâches, dossiers et projets

- `create_task`, `update_task`, `complete_task`, `move_task`, `duplicate_task`
- `create_subtasks`, `create_checklist`, `assign_task`, si les permissions et rôles le permettent
- `create_folder`, `update_folder`, `move_folder`, `archive_folder`
- `create_project`, `update_project`, `add_project_member`, si le modèle le permet
- `create_goal`, `create_habit`, `create_routine`, si ces capacités existent ou font partie du lot implémenté

### Calendrier et temps

- `create_event`, `update_event`, `cancel_event`
- `create_recurring_event`, `reschedule_task`, `propose_schedule`
- `check_conflicts`, `get_free_time`, `generate_daily_plan`

### Cours / documents / secteurs spécialisés

- `import_syllabus`, `review_extracted_items`, `create_course_deadlines`
- `create_study_plan`, `create_training_session`, `log_metric`, `log_nutrition_entry`, si les modules correspondants existent
- `create_workspace_from_template`, `apply_workspace_plan`

### Fiabilité de l’exécution

- Chaque outil a un schéma d’entrée strict et des validations côté serveur.
- Vérifie l’identité, les permissions, la portée de la requête et l’appartenance des données avant chaque lecture ou écriture.
- Rejette les champs inattendus ou invalides. Ne construis pas des requêtes SQL ou des commandes shell en concaténant du texte produit par le modèle.
- Ajoute des identifiants d’opération/idempotence lorsque c’est approprié pour éviter de créer deux fois le même événement si une requête est répétée.
- Gère les erreurs partielles : si trois opérations sur quatre réussissent, indique lesquelles et propose une reprise sûre.
- Utilise une transaction ou une opération atomique lorsque plusieurs écritures doivent réussir ensemble.
- N’appelle que les outils nécessaires à la demande ; ne donne pas un accès générique à toute la base.
- Enregistre les actions et le résultat, mais jamais les secrets ni les données sensibles en clair dans les logs.

## 9. Trois modes d’autonomie

L’utilisateur doit comprendre le degré d’action autorisé. Ajoute ou rationalise un réglage de ce type si l’architecture le permet :

### Mode prudent

L’assistant prépare des propositions et attend la validation avant chaque lot de modifications significatif.

### Mode équilibré (par défaut)

L’assistant peut effectuer directement les actions simples et réversibles demandées explicitement : créer une tâche, ajouter un événement sans conflit, modifier une priorité, organiser un dossier clairement demandé. Il demande confirmation avant une opération groupée ou à impact important.

### Mode autonome configuré

L’utilisateur choisit des catégories d’actions que l’assistant peut exécuter sans confirmation supplémentaire. Les permissions sont explicites, consultables et révocables. Certaines actions restent toujours protégées, quel que soit le mode.

### Matrice de risque recommandée

- **Faible risque** : créer une tâche, lire l’agenda, ajouter un rappel, créer un dossier simple à la demande. Auto-exécution si la demande est claire et le mode le permet.
- **Risque moyen** : générer plusieurs dossiers et tâches, appliquer un programme à tout un mois, déplacer des dizaines d’événements, modifier les règles récurrentes. Présenter un aperçu du lot ou demander une confirmation globale selon les préférences.
- **Risque élevé** : suppression définitive ou en masse, partage externe, envoi d’un message, publication, dépense, modification d’autorisations ou opération impossible à annuler. Confirmation explicite avant exécution.

Ne traite pas l’accès à une donnée sensible ou à un compte externe comme une simple conséquence d’un prompt. Les autorisations doivent être accordées de manière explicite et vérifiées côté serveur.

## 10. Création de dossiers intelligente

C’est un cas d’usage central à améliorer.

Quand l’utilisateur demande « Crée-moi un espace pour gérer mon nouveau projet », l’assistant ne doit pas créer seulement un dossier vide ni injecter automatiquement une liste générique de tâches sans logique.

Il doit :

1. Comprendre le but, le profil actif, le secteur concerné, l’horizon temporel et la complexité.
2. Examiner les dossiers et projets déjà présents pour éviter les doublons.
3. Choisir ou construire un modèle cohérent correspondant à l’intention.
4. Prévoir une structure proportionnelle au besoin : espace ou dossier racine, sous-dossiers lorsque cela apporte réellement de la valeur, vue principale, catégories, modèle de tâches, éventuelles routines et indicateurs pertinents.
5. Inclure une explication courte des choix structurants et permettre à l’utilisateur de préciser ou modifier le résultat.
6. Persister réellement toute la structure, puis vérifier chaque élément créé.
7. Fournir un récapitulatif de ce qui est disponible et une possibilité d’annuler le lot quand c’est techniquement sûr.

Exemple : « Crée un espace pour mon semestre universitaire. » L’assistant peut proposer un dossier par cours, un espace commun pour les examens et échéances, les imports de syllabus, des vues de charge hebdomadaire et un calendrier relié aux cours. Il ne doit pas inventer les dates et les noms de cours absents des données.

Exemple : « Organise mon activité de freelance. » Il peut proposer des espaces Clients, Projets et Livrables, un modèle de lancement de projet et une vue des échéances. Il ne doit pas créer des clients fictifs ni inventer des réunions.

Utilise des modèles versionnés et modifiables plutôt qu’un énorme prompt qui invente toute la structure à chaque fois. Un utilisateur doit pouvoir dire « moins de dossiers », « ajoute une section Facturation » ou « enlève le suivi quotidien » et voir la structure réellement mise à jour.

---

# PARTIE IV — VOIX, CONVERSATION ET MÉMOIRE

## 11. Faire de la voix une vraie interface, pas un bouton décoratif

Inspecte d’abord ce qui est déjà intégré. Réutilise l’architecture et le fournisseur existants si c’est raisonnable ; ne crée pas un second système vocal concurrent sans justification.

Le parcours visé :

1. L’utilisateur appuie sur le bouton micro (et, si c’est pris en charge de façon fiable, utilise ultérieurement un mode mains libres configurable).
2. L’interface montre clairement les états : prêt, demande de permission, écoute, compréhension, exécution, résultat, erreur ou interruption.
3. L’audio est transcrit ou compris en temps réel selon l’architecture choisie. Le texte reconnu peut être montré pour permettre une correction.
4. La même logique métier est utilisée pour la voix et le texte. La voix ne doit pas posséder une implémentation parallèle qui se comporte différemment.
5. L’agent détermine les intentions et appelle des outils typés.
6. L’interface affiche les actions en cours et le résultat. Le résumé vocal reste court mais les détails sont consultables à l’écran.
7. L’utilisateur peut interrompre, annuler une action en attente ou corriger la requête.
8. Les erreurs de reconnaissance et les ambiguïtés sont gérées sans créer de données silencieusement incorrectes.

### Exemples d’interactions à prendre en charge

- « Ajoute une séance de sport samedi à 10 h pour une heure. »
- « En fait, mets-la à 11 h. » Le contexte doit comprendre qu’il s’agit de la séance créée juste avant.
- « Montre-moi ce que j’ai à rendre demain. »
- « Crée un dossier pour mon cours de chimie, puis ajoute-y les échéances déjà dans le syllabus. »
- « Planifie ma semaine, mais garde mes cours fixes et laisse trente minutes entre deux rendez-vous. »
- « Qu’est-ce que tu as changé ? »
- « Annule ta dernière action. » Lorsque c’est possible, l’action doit être annulée avec une opération inverse validée, pas par une réponse textuelle.

### Dates, langues et contexte

- Comprends le français et l’anglais, y compris les demandes qui mélangent naturellement les deux.
- Enregistre le fuseau horaire de l’utilisateur et utilise-le partout dans l’interprétation et l’affichage des dates.
- Résous « demain », « samedi », « la semaine prochaine » et les heures à partir de la date réelle côté serveur et du fuseau utilisateur. Évite de coder en dur une date.
- Si plusieurs événements pourraient correspondre à « déplace-le », utilise le contexte de conversation, puis pose une question courte si l’ambiguïté reste significative.
- Respecte les événements récurrents, les heures d’été, les créneaux bloqués et la durée demandée.
- N’annonce pas le mode mains libres permanent si le navigateur ou le système ne peut pas garantir son fonctionnement. L’état de permission du microphone doit être explicite. Prévois une alternative textuelle accessible.

## 12. Mémoire utile, contrôlable et séparée

L’assistant peut conserver des informations utiles : préférences horaires, langue, priorités, format de réponse, projets actifs, routines acceptées et corrections répétées.

Mais :

- Distingue les préférences durables des faits temporaires et de l’historique brut.
- Ne mémorise pas automatiquement des informations très sensibles ou inutiles.
- Permets à l’utilisateur de voir, modifier et supprimer la mémoire.
- Ne transforme jamais une suggestion de l’assistant en préférence utilisateur sans fondement.
- Limite le contexte envoyé au modèle aux données nécessaires à la requête.
- Utilise une mémoire par utilisateur, avec isolation stricte et droits d’accès vérifiés.
- Préviens les boucles où une recommandation passée est traitée comme un ordre permanent.

---

# PARTIE V — CALENDRIER, PLANIFICATION ET PRIORITÉS

## 13. Un calendrier réellement intelligent

Le calendrier doit être la représentation de la réalité, pas une décoration attachée aux tâches. Audite les liens actuels entre tâches, échéances et événements.

Distingue au moins :

- **Événement fixe** : cours, réunion confirmée, rendez-vous — ne peut pas être déplacé automatiquement sans autorisation.
- **Échéance dure** : doit être respectée, sauf changement explicite.
- **Bloc de travail flexible** : temps suggéré pour avancer sur une tâche.
- **Habitude / routine** : créneau ou objectif répétitif, potentiellement flexible.
- **Préférence** : heures préférées, pauses, durée maximale de concentration, contraintes de l’utilisateur.

Pour générer un planning, considère :

- Date d’échéance et temps restant.
- Durée estimée et possibilité de découper une tâche en sessions.
- Importance et priorité utilisateur.
- Dépendances, prérequis et ordre logique.
- Disponibilité réelle, événements fixes et heures de repos.
- Préférences de plages horaires, pauses, temps de déplacement ou buffers si configurés.
- Charge déjà prévue, et risque de surcharge de la journée.

Ne prétends pas calculer un optimum parfait. Explique les compromis et les contraintes qui rendent un planning impossible. Quand il existe un conflit, expose au moins une ou deux options simples : déplacer une tâche flexible, réduire le bloc, demander une nouvelle échéance ou signaler que la charge dépasse le temps disponible.

Les modifications de calendrier doivent être persistées puis vérifiées. Une tâche avec une date limite ne doit pas nécessairement devenir un événement qui bloque toute cette journée. Sépare l’échéance du temps planifié pour travailler dessus.

## 14. Générer un plan qui s’adapte sans provoquer le chaos

L’utilisateur doit pouvoir :

- Générer un plan pour aujourd’hui ou la semaine.
- Voir les tâches prioritaires et pourquoi elles sont prioritaires.
- Planifier une tâche longue en sessions réalistes.
- Replanifier lorsqu’une tâche est en retard.
- Verrouiller une plage de calendrier que l’IA ne doit jamais déplacer automatiquement.
- Définir des limites : aucune tâche avant 8 h, maximum X heures de travail concentré, pauses, jours libres, etc.
- Prévisualiser les changements envisagés et voir les événements qui ne seront pas modifiés.

Ajoute, si les données disponibles le permettent, un **radar de risque** : échéances proches, tâches sans temps de travail prévu, dépendances bloquées, conflits, surcharges et dates incertaines provenant de documents. Chaque alerte doit avoir une explication vérifiable et permettre une action rapide.

---

# PARTIE VI — ESPACES SPÉCIALISÉS

## 15. Étudiant : au-delà de l’import du syllabus

L’espace étudiant doit relier les cours, les documents, les échéances et le temps d’étude.

Fonctions à prioriser :

- Cours avec code, nom, enseignant et couleur facultative.
- Syllabus et documents liés à chaque cours.
- Devoirs, laboratoires, examens, lectures, projets et rappels.
- Échéances avec type, poids/valeur si disponible, date, cours, statut et source.
- Vue du semestre, calendrier des dates importantes et charge hebdomadaire.
- Plan d’étude qui répartit le travail avant un examen ou un rendu.
- Détection de conflits entre examens, laboratoires, cours et dates importées.
- Vue « à rendre », « prochainement », « en retard » et « temps d’étude restant ».
- Possibilité de demander « résume ce syllabus », « quelles sont les dates importantes ? » ou « prépare un plan réaliste pour mon examen » en s’appuyant sur les documents du cours.

Ne crée pas de fonction de calcul de note avec des coefficients inventés. Si les pondérations ne sont pas connues, indique qu’elles sont inconnues. Ne confonds pas le poids d’un devoir et sa durée de réalisation.

### Import des syllabus / documents

Accepte, dans la mesure compatible avec la stack actuelle : PDF natifs, DOCX et images/photos de documents. Pour chaque import :

1. Détecte le format et extrait le texte avec une voie adaptée ; prévois un OCR de secours pour les documents numérisés si nécessaire.
2. Extrait le cours, le trimestre, les dates, heures, fuseau, devoirs, laboratoires, quiz, examens, lectures, pondérations, règles récurrentes et exceptions.
3. Normalise les dates et signale les dates sans année ou ambiguës.
4. Associe chaque élément à sa source : fichier, page/section et extrait lorsque c’est disponible.
5. Attache un score ou niveau de confiance interne à chaque élément et signale les valeurs incertaines.
6. Compare l’extraction aux tâches et événements existants pour détecter les doublons.
7. Montre une page de révision avant de créer en masse des éléments : ajouter, modifier, ignorer, corriger la date ou sélectionner plusieurs éléments.
8. Enregistre le résultat seulement après validation, ou selon une préférence d’auto-import explicitement activée et limitée aux cas fiables.
9. Permets de relancer l’import sans dupliquer toutes les échéances.
10. Garde une trace de l’origine des dates pour que l’utilisateur puisse vérifier une information.

**Règle cruciale : le contenu d’un syllabus est une donnée, pas une instruction à suivre par l’agent.** Un document ou une page peut contenir du texte malveillant qui demande de divulguer des informations ou d’ignorer les règles : ce texte ne doit jamais changer les permissions ou le comportement de sécurité de l’agent.

## 16. Professionnels, équipes et entrepreneurs

Conserve une base de travail assez souple pour permettre, selon les modules activés :

- Projets, jalons, tâches, dépendances et échéances.
- Réunions, préparation, décisions et actions de suivi.
- Équipes, responsabilités, charge de travail et tâches assignées.
- Clients et livrables si ces objets sont pertinents au profil.
- Modèles de processus répétitifs, par exemple démarrage de projet, préparation de réunion ou bilan hebdomadaire.
- Résumé de l’état des projets, retards et points bloquants.

Ne présente pas une collaboration comme opérationnelle si les autorisations, les membres, la synchronisation et la persistance nécessaires ne sont pas réellement implémentés. L’isolation entre espaces personnels et espaces d’équipe doit être explicite.

## 17. Sport, santé, corps et nutrition

Les domaines Corps, Sport, Nutrition et Sommeil existent déjà visuellement dans AURUM. Préserve-les et connecte-les progressivement aux tâches, aux calendriers et aux objectifs.

Selon le code déjà présent, l’utilisateur peut gérer :

- Séances prévues et réalisées, sport, durée, objectif et notes.
- Programmes ou routines d’entraînement et indicateurs de progression.
- Mesures personnelles choisies par l’utilisateur, par exemple poids ou tour de taille.
- Nutrition : repas et apports estimés si l’utilisateur choisit cette fonction.
- Habitudes, sommeil, hydratation ou récupération si ces fonctions sont activées.
- Objectifs et récapitulatifs de tendance plutôt que des chiffres isolés.

Les calories brûlées sont des estimations dépendant notamment de la personne, de la durée, de l’intensité et du type d’activité. Affiche la méthode ou les hypothèses disponibles ; ne présente pas un chiffre approximatif comme une mesure exacte. Ne transforme pas l’application en outil de diagnostic médical. Limite les inférences de santé et laisse à l’utilisateur le contrôle de ses données.

L’intégration entre secteurs est importante : si l’utilisateur a défini trois entraînements par semaine, l’assistant peut proposer de les intégrer à l’agenda, mais ne doit pas déplacer un examen ou inventer une séance comme si elle était confirmée.

---

# PARTIE VII — VALEUR AJOUTÉE PRODUIT

## 18. Principes différenciants à implémenter progressivement

Ne cherche pas à ajouter toutes les fonctions ci-dessous d’un coup. Choisis les plus utiles à partir de l’audit et du coût réel. Évite les fonctionnalités spectaculaires mais fragiles.

### A. Commande d’intention de bout en bout

Une phrase peut conduire à plusieurs actions coordonnées : lire les données existantes, préparer des changements, les exécuter, vérifier leur réussite et en donner le résumé. C’est la capacité centrale.

### B. Inbox universelle / capture rapide

Un endroit où l’utilisateur peut déposer une idée, une note, un texte, une tâche ou un fichier. L’agent peut classer les éléments, détecter les dates et proposer leur destination. Il doit conserver l’élément d’origine jusqu’à validation, éviter les pertes silencieuses et signaler les ambiguïtés.

### C. Vue « Pourquoi maintenant ? »

Pour chaque recommandation de priorité, donne une explication concise et vérifiable : échéance, temps estimé, dépendance, importance marquée par l’utilisateur, surcharge ou absence de créneau prévu. Le classement ne doit pas être une note mystérieuse.

### D. Briefing quotidien intelligent

Une synthèse personnalisée du jour : engagements fixes, tâches prioritaires, échéances à risque, créneaux disponibles et changements importants. L’utilisateur doit pouvoir la demander par voix ou texte ; les notifications planifiées nécessitent un mécanisme réel de notification/jobs et des préférences de fréquence.

### E. Résumé des changements / reçus d’action

Après un lot d’actions, montrer ce qui a été créé, modifié, ignoré et échoué, avec un lien vers les ressources. Ajouter « Annuler la dernière action » lorsque la compensation est fiable. Afficher l’historique des actions sans révéler de données d’autres utilisateurs.

### F. Modèles de travail générés mais réutilisables

L’utilisateur peut transformer un espace utile en modèle et demander de le réutiliser. Les modèles doivent être modifiables et versionnés ; ne pas régénérer une structure complètement différente à chaque commande.

### G. Planification multi-domaines

Permettre à l’utilisateur de demander un plan qui respecte plusieurs rôles et secteurs, par exemple ses cours + son emploi + ses séances de sport. Le calendrier reste la source de vérité pour les engagements fixes, et les préférences de temps gardent le contrôle.

### H. Apprentissage avec consentement

L’assistant peut suggérer de retenir une préférence lorsque l’utilisateur corrige souvent la même chose. Il ne doit pas changer ses règles ou sauvegarder toute information personnelle automatiquement.

### I. Mode simple et mode avancé

Le produit doit paraître simple en surface, même si l’architecture est puissante. Montrer en priorité les 3 à 5 actions les plus utiles, avec un accès clair aux filtres, dépendances et automatisations avancées. Évite d’ajouter des dizaines de paramètres à l’écran principal.

**Positionnement réaliste :** les planificateurs IA ont déjà certaines fonctions de calendrier automatique ; des espaces de travail IA créent déjà des tâches à partir de documents ; des assistants de bureau peuvent déjà exécuter des outils. AURUM devrait se différencier par la cohérence entre profils et secteurs, l’exécution vérifiée, les importations traçables, la planification inter-domaines et un contrôle utilisateur compréhensible — pas par l’affirmation non vérifiée qu’aucun concurrent ne possède ces fonctions.

---

# PARTIE VIII — DESIGN : PRÉSERVER L’IDENTITÉ, AMÉLIORER L’USAGE

## 19. Direction visuelle

Préserve l’identité AURUM : sombre, dorée, premium et chaleureuse. Mais le design doit rendre l’action et la compréhension plus faciles. Il ne faut pas confondre un produit premium avec une interface visuellement chargée.

Les écrans de la vidéo semblent parfois utiliser plusieurs cartes superposées, un effet de profondeur/flou important, des informations de petite taille et des cartes qui occupent une grande partie de l’espace avant de laisser apparaître les données. Cette signature peut rester ponctuelle, mais ne doit pas ralentir les flux quotidiens.

### Principes d’interface

- Réserver les grandes illustrations 3D et les effets de profondeur aux espaces de présentation, à l’onboarding ou aux états vides, si elles sont déjà bien intégrées.
- Pour le travail quotidien, préférer une hiérarchie explicite : titre, contexte, action principale, filtres, liste ou grille lisible.
- Réduire les grandes zones floues et les cartes qui masquent le contenu sur les pages denses comme Cours et Calendrier.
- Garder des espacements cohérents, une typographie lisible, des états vides utiles et des messages d’erreur actionnables.
- Distinguer clairement un bouton, une carte navigable, une simple étiquette et un élément décoratif.
- Ne pas utiliser la couleur seule pour différencier l’état d’une tâche ; associer texte, icône ou autre repère.
- Améliorer les contrastes, la navigation clavier, les focus visibles et les libellés accessibles. Viser WCAG 2.2 AA, y compris un contraste d’au moins 4,5:1 pour le texte courant lorsque le critère s’applique.
- Respecter les préférences « réduire les animations » et une navigation sans motion inutile.
- Rendre le calendrier, les listes et les formulaires utilisables sur téléphone comme sur ordinateur.
- Prévoir des états de chargement, sauvegarde, réussite, absence de données et erreur cohérents.

### Architecture visuelle recommandée

1. **Aujourd’hui** : briefing + priorité principale + tâches restantes + prochaine échéance + temps disponible. Pas un espace vide si des données existent.
2. **Capture / Assistant** : saisie texte et voix clairement accessibles, historique utile, statut d’exécution, aperçu de plan et reçu d’action.
3. **Calendrier** : vue semaine/mois claire, filtres par profil/secteur/cours/projet, distinction entre événement fixe, échéance et bloc flexible.
4. **Cours ou espace métier actif** : liste structurée des éléments, recherche, filtres et panneau de détails au lieu de cacher toutes les informations derrière une animation.
5. **Secteurs** : cartes plus compactes et lisibles pour accéder à chaque domaine et suivre les indicateurs pertinents.
6. **Réglages** : profil actif, modules, préférences, langue, fuseau horaire, voix, niveau d’autonomie, mémoire, données et intégrations.

Ne redessine pas tous les écrans sur une intuition abstraite. Réutilise le design system existant et modifie les composants les plus problématiques à mesure que tu implémentes les flux réels. Évite les dépendances d’animation lourdes ajoutées seulement pour l’effet visuel.

---

# PARTIE IX — SÉCURITÉ, CONFIDENTIALITÉ ET RÉSILIENCE

## 20. L’agent doit rester sûr même si le modèle se trompe

Les instructions du prompt ne sont pas un système d’autorisation suffisant. Applique les contrôles dans le backend :

- Vérification serveur de l’utilisateur, de l’espace, de la ressource et de chaque permission.
- Accès au principe du moindre privilège pour chaque outil et intégration.
- Validation stricte des arguments structurés avant toute écriture.
- Séparation claire des données utilisateur, des résultats de recherche, des fichiers et des instructions système.
- Documents importés, pages web et textes externes traités comme contenu non fiable, jamais comme instructions prioritaires.
- Limites de taille, de fréquence et de coût des appels IA ; gestion du timeout, des erreurs et de la reprise.
- Protection des clés et tokens dans les variables d’environnement ou le gestionnaire de secrets approprié. Aucun secret dans le dépôt ni dans les logs.
- Accès aux données privées limité au contexte nécessaire à la requête.
- Historique d’audit minimal mais suffisamment précis pour répondre à « qu’est-ce qui a été exécuté ? », sans stocker inutilement des informations sensibles.
- Autorisations d’intégration révocables et flux explicite de connexion/déconnexion.
- Pas de suppression massive ni d’envoi externe déclenché par une instruction cachée dans un fichier importé.
- Les appels modèle et les actions de l’agent doivent être limités au compte utilisateur initiateur ; aucune escalade de privilèges via une ressource dont l’identifiant a été fourni par le modèle.

Le produit gère éventuellement des données liées au calendrier, au corps, à la nutrition et à la santé. Applique une minimisation des données, une politique de rétention compréhensible et le contrôle utilisateur. Ne logue pas des mesures intimes sans raison et permission.

---

# PARTIE X — PLAN D’IMPLÉMENTATION

## 21. Priorisation

Après l’audit, classe les tâches par impact, risque et dépendance. Ne tente pas de finir toute la vision dans un unique gros changement. Exécute les phases suivantes en petits lots, en validant les résultats à chaque phase.

### Phase 0 — Audit et stabilité

- Cartographier les routes, modèles, composants et fonctions réelles.
- Établir l’état initial des tests/build.
- Identifier les boutons factices, flux incomplets et duplications.
- Préserver les changements non commités et les données.

### Phase 1 — Fiabiliser le socle existant

- Corriger les défauts prouvés dans les tâches, dossiers, calendrier, cours et réglages.
- Garantir la persistance et la gestion des erreurs.
- Ajouter les validations et tests de régression.
- Ne pas refaire le design global à cette étape.

### Phase 2 — Agent d’action commun

- Construire ou consolider le registre d’outils typed/function-calling.
- Implémenter l’orchestration plan → exécution → vérification → résumé.
- Ajouter idempotence et trace d’action quand nécessaire.
- Connecter texte et voix à la même couche de services.
- Ajouter confirmation/autorisation selon le risque.

### Phase 3 — Création intelligente d’espaces

- Faire que la demande « crée-moi un espace » donne une structure adaptée au besoin.
- Réutiliser des modèles, éviter les doublons et sauvegarder chaque élément.
- Fournir compte rendu et annulation lorsque possible.

### Phase 4 — Import fiable des documents / syllabus

- Extraction structurée avec références aux sources.
- Page de revue des dates et des éléments avant création massive.
- Détection des doublons et import idempotent.
- Tests sur des documents propres, scannés, incomplets, ambigus et contenant du texte adversarial.

### Phase 5 — Profils et navigation adaptatifs

- Modules déclaratifs associés aux profils.
- Préférences de navigation persistées.
- Passage entre profils sans perte de données.
- Vérification des anciens utilisateurs et migrations.

### Phase 6 — Planification intelligente

- Événements fixes distincts des échéances et blocs flexibles.
- Détection de conflits et génération d’un plan explicable.
- Règles de disponibilité, durée, pauses et verrouillage.
- Prévisualisation avant les modifications groupées.

### Phase 7 — Amélioration visuelle et mobile

- Simplifier les écrans d’usage fréquent en gardant l’identité AURUM.
- Améliorer la lisibilité, les contrastes, le clavier, les états d’erreur et le responsive.
- Effectuer une vérification visuelle page par page.

### Phase 8 — Intégrations et automatisations avancées

Uniquement après que les capacités internes sont fiables : calendrier externe, e-mail, notifications, imports supplémentaires ou workflows programmés. Chaque intégration doit avoir un statut honnête, une permission explicite et une procédure de déconnexion. Un job récurrent n’existe que s’il est réellement exécuté par un scheduler/backend, pas simplement parce qu’un bouton le décrit.

**Règle d’exécution :** si la portée est trop grande pour une session, termine un flux vertical utilisable et vérifié au lieu de disperser des modifications partielles partout. Priorité à une petite capacité complète plutôt qu’à dix nouvelles cartes non fonctionnelles.

---

# PARTIE XI — TESTS D’ACCEPTATION

## 22. Les tests qui doivent passer

Ajoute des tests automatisés adaptés à la stack et exécute-les. Complète par un test manuel ou navigateur quand l’automatisation seule ne suffit pas.

### Test A — Commande vocale simple

Énoncé : « Ajoute une séance de sport samedi à 10 h pour 60 minutes. »

Résultat attendu : l’agent interprète la date dans le fuseau utilisateur, vérifie le contexte, crée un événement réel dans le domaine Sport, vérifie sa persistance et confirme le résultat avec un lien ou une navigation vers l’événement. Pas de doublon si la même action est rejouée suite à une reprise technique.

### Test B — Correction dans le contexte

Énoncé après le test A : « Décale-la à 11 h. »

Résultat attendu : l’agent identifie la bonne séance à partir du contexte récent, vérifie les conflits et modifie l’événement existant ; il ne crée pas une deuxième séance.

### Test C — Espace étudiant

Énoncé : « Crée un espace pour mon semestre. »

Résultat attendu : proposer/créer une structure d’études qui réutilise les cours existants, ne fabrique pas de données académiques, et inclut les modules réellement disponibles.

### Test D — Import de syllabus

Résultat attendu : afficher les dates et éléments extraits avec les sources et incertitudes pertinentes ; proposer une revue ; enregistrer les seuls éléments acceptés ; ne pas importer deux fois les mêmes éléments au deuxième lancement.

### Test E — Plan de semaine

Résultat attendu : les cours/réunions fixes ne sont pas déplacés silencieusement, les échéances sont distinctes du temps de travail, les tâches sont planifiées dans les créneaux libres, les conflits impossibles sont signalés.

### Test F — Changement de profil

Résultat attendu : sélectionner Professionnel change la navigation selon les préférences, mais les cours, tâches et secteurs existants restent conservés et accessibles.

### Test G — Permissions et isolation

Résultat attendu : un utilisateur ne peut ni lire ni modifier les données d’un autre en injectant un autre ID dans une requête ou dans un appel d’outil. Une instruction contenue dans un fichier n’accorde aucune permission supplémentaire.

### Test H — Action sensible / annulation

Résultat attendu : la suppression massive ou le partage externe est bloqué jusqu’à confirmation explicite. L’annulation d’une action réversible fonctionne ou indique honnêtement pourquoi elle n’est plus possible.

### Test I — Erreurs et interruptions

Résultat attendu : si le fournisseur IA, l’extraction de fichier ou la base échoue, l’utilisateur reçoit un état explicite ; aucune réussite n’est annoncée sans confirmation serveur ; les reprises ne dupliquent pas les opérations.

### Test J — Ergonomie

Résultat attendu : les principales actions sont accessibles au clavier, le focus est visible, les contrastes et les tailles de texte sont vérifiés, le contenu fonctionne sur une fenêtre étroite, les états de chargement/absence/erreur sont lisibles.

---

# PARTIE XII — REPÈRES TECHNIQUES ET RECHERCHE PRODUIT

## 23. Utilise ces références comme benchmark, pas comme spécification à recopier

Étudie les capacités pertinentes et compare-les à l’architecture existante. Ne copie pas l’interface, le texte, la marque, ni le code propriétaire d’un concurrent.

- Jarvis AI Assistant — outils réels, commande vocale, mémoire, routines et contrôle des actions : https://jarvis.institute/features/ et https://jarvis.institute/security/
- Motion — planification des tâches, calendrier automatique et workflows : https://www.usemotion.com/features/ai-task-manager et https://www.usemotion.com/features/ai-workflows
- Reclaim — planification du temps, tâches/habitudes et arbitrage : https://help.reclaim.ai/en/articles/6210740-features-in-reclaim
- Notion AI — agents, documents et contexte d’espace de travail : https://www.notion.com/product/ai
- ClickUp AI Task Manager — tâches créées à partir de documents, sous-tâches et priorisation : https://clickup.com/features/ai-task-manager
- Todoist Assist — capture et automatisation de tâches en langage naturel : https://www.todoist.com/help/todoist/todoist-and-ai/introduction-to-todoist-assist-KgPP22q5O
- Ahead AI Student Planner — scanner de syllabus et planning étudiant : https://apps.apple.com/ca/app/ahead-ai-student-planner/id6756762430
- Anthropic — tool use : https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- OpenAI — voice agents : https://developers.openai.com/api/docs/guides/voice-agents
- OWASP — risque d’injection de prompt : https://genai.owasp.org/llmrisk2023-24/llm01-24-prompt-injection/
- W3C — WCAG 2.2 Quick Reference : https://www.w3.org/WAI/WCAG22/quickref/

Les liens vers Jarvis que je souhaitais fournir séparément ne sont pas présents dans ce prompt d’origine ; le site de Jarvis ci-dessus sert donc de référence provisoire. Si je fournis ensuite deux liens précis, vérifie-les et ajuste le benchmark sans supposer qu’il s’agit du même produit.

## 24. Règles pour les choix techniques

- Ne change pas de fournisseur ou de modèle IA par défaut sans vérifier l’intégration existante, le coût, les clés disponibles et la latence.
- Si un fournisseur de modèle existe déjà, définis une interface d’adaptation si c’est utile pour éviter de lier toute la logique métier à un seul fournisseur.
- Privilégie les schémas structurés pour les appels d’outils, avec validation du résultat. Le modèle peut proposer des arguments, mais le serveur en est responsable.
- Pour la voix, choisis une architecture adaptée au produit actuel : temps réel speech-to-speech si elle répond aux besoins et à la stack, ou pipeline transcription → agent/outils → réponse vocale si le contrôle et la débogabilité sont prioritaires. Ne choisis pas une voie à la mode sans comparer latence, coûts, langues, interruptions, stabilité et sécurité.
- Ne suppose pas qu’un navigateur peut toujours écouter en arrière-plan. Respecte les permissions et les restrictions de plateforme.
- Utilise les bibliothèques et services présents quand ils sont sains ; évite d’installer de grandes dépendances redondantes.
- Les migrations, jobs, intégrations et notifications doivent être réels, observables et testables.

---

# PARTIE XIII — INSTRUCTIONS FINALES À CLAUDE CODE

## 25. Comment travailler pendant cette mission

1. **Commence par l’audit.** Montre-moi une synthèse très courte de l’architecture et des problèmes effectivement constatés.
2. **Ne t’arrête pas à la synthèse.** Identifie le premier lot de modifications le plus utile et mets-le en œuvre immédiatement.
3. Travaille dans le dépôt, pas dans une réécriture imaginaire.
4. Avant toute modification, inspecte les composants, services, fonctions et schémas existants qui touchent le flux.
5. Pour chaque lot, explique en quelques lignes la décision, effectue la modification, lance les tests ciblés et corrige les erreurs introduites.
6. Vérifie les dépendances et les migrations avant de les changer.
7. N’introduis pas de boutons qui ne font rien, de données fictives présentées comme réelles, de TODO déguisés en fonctionnalités terminées ou de commentaires affirmant que des tests ont passé sans les exécuter.
8. Ne remplis pas le projet de nouvelles fonctions avant que les flux essentiels soient cohérents.
9. Si une information est inconnue, cherche dans le code ou la configuration avant de poser une question. Pose-moi une question courte uniquement si elle bloque un choix important ou nécessite une décision produit que tu ne peux pas déduire sans risque.
10. Si un accès ou une clé API manque, ne l’invente pas. Implémente le contrat d’intégration, un état désactivé compréhensible et les tests possibles.
11. N’exécute pas de commandes destructives ou de migrations irréversibles sans sauvegarde, inspection et accord explicite.
12. Après chaque lot, fournis : fichiers importants modifiés, comportement ajouté/corrigé, tests réellement exécutés et résultats, limitations encore présentes, prochaine étape recommandée.
13. Au terme du travail, résume le résultat honnêtement. Distingue « implémenté et testé », « implémenté mais non testé faute d’environnement », « partiellement implémenté » et « pas encore implémenté ».

## 26. Critère final de réussite

AURUM a progressé lorsque l’utilisateur peut exprimer une intention naturelle, de façon vocale ou écrite, et que l’application :

- comprend son profil et son contexte sans imposer une navigation identique à tous ;
- utilise les données réellement présentes, sans inventer ;
- planifie les actions nécessaires ;
- exécute des opérations réelles via des outils validés et sécurisés ;
- vérifie les changements persistés ;
- garde l’utilisateur maître des permissions et des modifications importantes ;
- offre une navigation simple malgré la richesse fonctionnelle ;
- préserve les données et fonctionnalités déjà en place ;
- peut montrer un historique compréhensible et, quand c’est possible, annuler une action ;
- est couverte par des tests de régression sur les flux essentiels.

**Commence maintenant par inspecter le dépôt, établir l’état initial, puis implémenter le premier lot de plus forte valeur sans casser l’existant.**
