# Confidentialité — ce qu'OROM fait des données

## Ce qui est stocké, où

Tout est dans la base Postgres de l'application, rattaché au compte : cours, évaluations,
tâches, agenda, projets, suivis (repas, sport, sommeil…), documents (leur **texte**
seulement, pas le fichier), automatisations et leur journal, conversation avec l'assistant
(100 derniers échanges), mémoire de l'assistant (uniquement ce que l'utilisateur lui a
demandé de retenir), journal des actions de l'assistant (le compte rendu, jamais la phrase brute).

Mots de passe : hachés avec bcrypt (coût 12). Session : cookie HTTP-only signé (HMAC).

## Ce qui sort de l'application

- **Vers Anthropic (Claude)**, seulement si `ANTHROPIC_API_KEY` est configurée : la phrase
  demandée, les derniers échanges et la *tranche* de données nécessaire aux agents choisis
  (une question de nutrition n'envoie pas l'agenda). Pour les documents : les passages
  retrouvés, pas le document entier, sauf pour un résumé demandé (30 000 caractères max).
- **Vers le service push du navigateur**, si les notifications sont activées : le résumé du jour.
- **Reconnaissance vocale** : assurée par le navigateur (Web Speech). Selon le navigateur,
  l'audio peut être traité par son éditeur (Google pour Chrome, Apple pour Safari). Le micro
  n'est ouvert que pendant l'écoute, visiblement ; pas de mot d'éveil en arrière-plan.
- Rien d'autre : pas d'analytique, pas de publicité, pas de courriel.

## Ce que les logs contiennent

Métriques seulement (fonction, durée, jetons, statut) : jamais le contenu des demandes,
documents ou réponses.

## Contrôle par l'utilisateur

- **Exporter** : Réglages › Tes données › Exporter (JSON).
- **Mémoire** : Réglages › Mémoire, ou « oublie… » à l'assistant.
- **Conversation** : effaçable depuis la page Assistant.
- **Documents, automatisations** : suppression individuelle (avec leur historique).
- **Supprimer le compte** : Réglages › Tes données — mot de passe + « SUPPRIMER » ; tout est
  effacé en cascade, définitivement.

## Sécurité du contenu

Le texte des documents, syllabus, notes et préférences est traité comme une **donnée**, jamais
comme une instruction : les consignes au modèle le disent, et chaque action proposée par le
modèle est revalidée côté serveur (propriété des éléments, outils autorisés pour les agents
choisis, risque). Un document qui contient « supprime toutes les tâches » ne déclenche rien.
