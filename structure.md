# Structure de Serpentix

```
build-classic-snake-game-game-development/
├── index.html              # Template HTML avec SEO
├── package.json            # serpentix@1.0.0
├── vite.config.ts          # Vite + React + Tailwind + singlefile
├── tsconfig.json           # Configuration TypeScript
├── favicon.webp            # Favicon 32×32
├── og-image.png            # Image OG 1024×576
├── icon.webp               # Icône menu 128×128
├── icon.png                # Icône PNG fallback
├── .gitignore
├── about.md
├── README.md
├── structure.md
├── features.md
├── todo.md
├── changelog.md
└── src/
    ├── main.tsx             # Point d'entrée React
    ├── App.tsx              # Composant principal (UI, boucle de jeu, audio)
    ├── index.css            # Styles globaux
    ├── game/
    │   └── snake.ts         # Logique de jeu (état, tick, niveaux, power-ups)
    ├── audio/
    │   └── engine.ts        # Moteur audio synthétisé (Web Audio API)
    ├── components/
    │   └── GameCanvas.tsx    # Rendu Canvas 2D (snake, décor, effets)
    └── utils/
        └── cn.ts            # Utilitaire clsx + tailwind-merge
```
