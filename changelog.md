# Changelog Serpentix

## [1.2.0] 2026-08-03

### Ajoute
- Bouton Infos dans l'en-tete, ouvrant une modale avec la stack, les graphismes, la
  musique, les interactions et les algorithmes notables (vitesse progressive, 3 power-ups
  temporaires qui modifient les regles de collision). Etape 15 du chantier de retrofit
  decrit dans `todo.md` racine du monorepo.

### Corrige
- 3 tirets longs (libelle de niveau en jeu, credit de pied de page, titre de ce changelog)
  remplaces par des deux-points ou virgules, en conformite avec la regle du depot.

### Verifie
- Build propre, modale testee a l'ouverture/fermeture, aucune erreur console, aucun
  debordement horizontal en 390x844.

## [1.1.0] — 2026-07-29
### Ajouté
- Musique synthwave améliorée (Am-F-C-G, 130 BPM, 5 couches)
- Pad sidechain, arpège (score≥30), lead mélodique (score≥80)
- Filtre s'ouvre avec la vitesse
- Kick 808 amélioré, hi-hat open/closed
- Power-ups : invincible (★), aimant (🧲), ralenti (⏱)
- Niveaux infinis procéduraux après le Labyrinthe
- Auto-pause au blur (visibilitychange)
- Effet trail derrière le serpent
- Screen shake renforcé
- Grille pulse au rythme de la musique
- Effets sonores : playTurn, playPowerUp, playNearDeath, eat varié
- Statistiques globales (pommes, parties, niveau max, temps)
- Bouton stats dans le header
- Renommage Snake Néon → Serpentix (h1, meta, localStorage)
- Documentation : about.md, README.md, structure.md, features.md, todo.md

## [1.0.0] — 2026-07-28
### Ajouté
- Version initiale : Serpentix
- Snake classique avec grille 20×20
- 6 niveaux à difficulté progressive
- Musique procédurale basique (124 BPM)
- High score persistant (localStorage)
- Contrôles clavier et tactiles
- Rendu Canvas 2D fluide
- Meta tags SEO complets
- Image Open Graph
- Favicon
