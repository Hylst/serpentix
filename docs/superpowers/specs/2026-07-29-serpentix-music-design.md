# Serpentix — Amélioration musique synthwave + rename

## Objectif
Améliorer la musique procédurale de Serpentix (actuellement basique) avec un style
synthwave rétro dynamique, et renommer l'interface "Snake Néon" → "Serpentix".

## Musique

### Tonalité & structure
- **Tonalité** : La mineur (Am)
- **Grille d'accords** : Am → F → C → G (i → VI → III → VII)
- **BPM** : 130
- **Mesure** : 16 temps (4 accords × 4 temps)

### Couches
1. **Drums** : kick 808 amélioré, snare avec reverb, hi-hats open/closed
2. **Basse** : root notes + octave jumps typiques synthwave, filtre
3. **Pad** (nouveau) : nappe sawtooth sustain, sidechain pump sur le kick
4. **Arpège** (nouveau) : doubles croches sur les arpèges des accords
5. **Lead** (nouveau) : mélodie pentatonique, activée à haut score

### Dynamique gameplay
| Condition | Effet |
|-----------|-------|
| Score ≥ 30 ou Level ≥ 2 | Arpège activé |
| Score ≥ 80 ou Level ≥ 4 | Lead activé |
| Vitesse ↑ | Filtre passe-bas s'ouvre |
| Nouveau record | Percussion + ouverture max |
| Game Over | Filtre fermé, fondu |
| Level Up | Pause + filtre sweep |

## Renommage
- `Snake Néon` → `Serpentix` (title, h1, meta OG)
- `snake-neon-record-v3` → `serpentix-record-v3`

## Fichiers modifiés
- `src/audio/engine.ts` — réécriture startMusic + nouvelles primitives
- `src/App.tsx` — rename UI + localStorage key
- `index.html` — title + meta
