# Serpentix — Music Synthwave Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Serpentix procedural music to synthwave style with dynamic gameplay-reactive layers, and rename "Snake Néon" to "Serpentix".

**Architecture:** Single `AudioEngine` class in `src/audio/engine.ts` generates all sounds via Web Audio API. The `startMusic()` method is rewritten to use chord-based harmonic progression (Am-F-C-G) with 5 layers (drums, bass, pad, arp, lead) that activate based on score/level/speed thresholds.

**Tech Stack:** React 19, Web Audio API, TypeScript 5.9, Vite 7

## Global Constraints

- No external audio libraries — all sounds synthesized via Web Audio API
- Must remain under ~300 lines for engine.ts (currently 348, target similar)
- Must not use `any` types — strict TypeScript
- LocalStorage key rename must handle old key gracefully
- Game title "Serpentix" in UI, not "Snake Néon"

---

### Task 1: Rename UI — "Snake Néon" → "Serpentix"

**Files:**
- Modify: `index.html:6,7,10,11,13,15,17`
- Modify: `src/App.tsx:15,514-518`
- Modify: `src/audio/engine.ts` (no changes needed here)

- [ ] **Step 1: Update index.html meta**

Change title line 6:
`<title>Serpentix — Snake néon arcade</title>` → `<title>Serpentix — Le serpent qui danse au rythme du synthwave</title>`

Change meta description line 7:
`content="Serpentix : le classique Snake réinventé en néon. 6 niveaux, obstacles, musique procédurale, high score. Joue gratuitement !"` → `content="Serpentix : le Snake revisité synthwave. 6 niveaux, obstacles, musique procédurale dynamique. Joue gratuitement !"`

Change OG title line 10:
`content="Serpentix — Snake néon arcade"` → `content="Serpentix"`

Change OG description line 11:
`content="Snake néon : 6 niveaux avec obstacles, musique procédurale, contrôle tactile."` → `content="Serpentix : 6 niveaux, obstacles, musique synthwave dynamique. Joue gratuitement !"`

Change Twitter title line 15:
`content="Serpentix — Snake néon arcade"` → `content="Serpentix"`

Change Twitter description line 16:
`content="Snake néon : 6 niveaux, obstacles, high score."` → `content="Serpentix : 6 niveaux, obstacles, musique synthwave. Joue gratuitement !"`

- [ ] **Step 2: Update App.tsx h1**

Find line 515: `<h1 ...>Snake Néon</h1>` → `<h1 ...>Serpentix</h1>`

Find line 517-518:
```tsx
<p className="text-[11px] text-emerald-300/70">
  Le grand classique, version améliorée
</p>
```
→
```tsx
<p className="text-[11px] text-emerald-300/70">
  Le serpent qui danse au rythme du synthwave
</p>
```

- [ ] **Step 3: Update localStorage key**

Line 15: `const HIGH_SCORE_KEY = "snake-neon-record-v3";` → `const HIGH_SCORE_KEY = "serpentix-record-v3";`

---

### Task 2: Rewrite music engine — Synthwave with dynamic layers

**Files:**
- Rewrite: `src/audio/engine.ts` (complete rewrite of `startMusic`, add new primitives)

**Interfaces:**
- Consumes: same public API (`startMusic`, `stopMusic`, `setMusicOn`, `setSfxOn`, `unlock`, SFX methods)
- Produces: same public API + new method `setIntensity(score: number, levelIndex: number, speedMs: number)` to drive dynamic layers

- [ ] **Step 1: Add new method `setIntensity` and state tracking**

Add to class fields:
```typescript
private currentIntensity = { score: 0, level: 0, speed: 170, record: false };
```

Add method:
```typescript
setIntensity(score: number, levelIndex: number, speedMs: number, record: boolean) {
  this.currentIntensity = { score, level: levelIndex, speed: speedMs, record };
}
```

- [ ] **Step 2: Rewrite `startMusic` with new harmonic structure**

Replace the entire `startMusic` method. New structure:
- BPM 130
- Chord progression: Am(220,261.63,329.63) → F(174.61,220,261.63) → C(261.63,329.63,392) → G(196,246.94,329.63)
- 16-step pattern (4 chords × 4 steps)
- Base drum pattern: kick on 1,5,9,13; snare on 5,13; hats every 2 steps
- Call the new layer methods each cycle

```typescript
startMusic() {
  if (this.musicTimer != null) return;
  this.ensure();
  if (!this.ctx || !this.musicBus) return;

  const BPM = 130;
  const STEP = (60 / BPM) / 4 * 1000;

  // Chord progression: Am - F - C - G (root, third, fifth)
  const chords: [number, number, number][] = [
    [220, 261.63, 329.63],     // Am
    [174.61, 220, 261.63],     // F
    [261.63, 329.63, 392],     // C
    [196, 246.94, 329.63],     // G
  ];

  this.musicTimer = window.setInterval(() => {
    if (!this.ctx || !this.musicBus || !this.musicGain) return;
    const t = this.now() + 0.04;
    const step = this.beat;
    const chordIdx = Math.floor(step / 4) % 4;
    const chord = chords[chordIdx];
    const { score, level, speed, record } = this.currentIntensity;

    const layerArp = score >= 30 || level >= 2;
    const layerLead = score >= 80 || level >= 4;
    const filterOpen = Math.min(1, (175 - speed) / 110); // 0-1 based on speed

    // Filter opens with speed
    if (this.filter) {
      this.filter.frequency.value = 2600 + filterOpen * 7400;
    }

    // Kick: every 4 steps
    if (step % 4 === 0) this.kick(t);
    // Snare: on steps 4 and 12 (within 16-step measure)
    if (step % 8 === 4) this.snare(t);
    // Hi-hat: every 2 steps, with open hat on 7,15
    if (step % 2 === 1) this.hat(t, step % 8 === 7);
    // Extra percussion on record
    if (record && step % 8 === 6) this.noiseHit(t, 0.08, 0.12);

    // Bass: root note of chord, octave jump pattern
    const bassPattern = [0, 12, 0, 7]; // semitone offsets
    const bassOffset = bassPattern[step % 4];
    this.bass(chord[0] * Math.pow(2, bassOffset / 12), t, 0.35);

    // Pad: sustained chord with sidechain (volume ducks on kick)
    if (step % 4 === 0) {
      chord.forEach((f, i) => {
        const vol = step % 4 === 0 ? 0.035 : 0.06; // sidechain effect
        this.padNote(f, t + i * 0.06, 0.5, i === 0 ? 0.035 : 0.06);
      });
    }

    // Arpège (layer 2)
    if (layerArp) {
      const arpNotes = [...chord].reverse();
      const n = arpNotes[step % 3];
      const octave = step % 8 < 4 ? 1 : 2;
      this.musicNote(n * octave, t, 0.1, "triangle", 0.055, true);
    }

    // Lead (layer 3) — pentatonic melody fragment
    if (layerLead && step % 8 === 0) {
      const leadNotes = [523.25, 659.25, 783.99, 659.25, 523.25, 392, 440, 523.25];
      const idx = Math.floor(step / 8) % leadNotes.length;
      this.musicNote(leadNotes[idx], t, 0.22, "sawtooth", 0.04, false);
    }

    this.beat = (this.beat + 1) % 64;
  }, STEP);
}
```

- [ ] **Step 3: Add `padNote` primitive**

```typescript
private padNote(freq: number, when: number, dur: number, gain: number) {
  if (!this.ctx || !this.musicBus) return;
  const osc = this.ctx.createOscillator();
  const g = this.ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.02);
  g.gain.setTargetAtTime(0.0001, when + dur * 0.7, dur * 0.15);
  osc.connect(g);
  g.connect(this.musicBus);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}
```

- [ ] **Step 4: Update `hat` primitive for open/closed**

```typescript
private hat(t: number, open: boolean = false) {
  if (!this.ctx || !this.musicBus) return;
  const hp = this.ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = open ? 4000 : 7000;
  const g = this.ctx.createGain();
  const vol = open ? 0.08 : 0.14;
  const dur = open ? 0.15 : 0.05;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  this.noiseBurst(t, dur, 0.3, g);
  g.connect(hp);
  hp.connect(this.musicBus!);
}
```

- [ ] **Step 5: Update `kick` for deeper 808 feel**

Update `kick` in engine.ts:
```typescript
private kick(t: number) {
  if (!this.ctx || !this.musicBus) return;
  const osc = this.ctx.createOscillator();
  const g = this.ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.2);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(g);
  g.connect(this.musicBus);
  osc.start(t);
  osc.stop(t + 0.4);

  // Click layer for attack
  const click = this.ctx.createOscillator();
  const cg = this.ctx.createGain();
  click.type = "sine";
  click.frequency.setValueAtTime(900, t);
  click.frequency.exponentialRampToValueAtTime(200, t + 0.02);
  cg.gain.setValueAtTime(0.18, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  click.connect(cg);
  cg.connect(this.musicBus);
  click.start(t);
  click.stop(t + 0.04);
}
```

- [ ] **Step 6: Wire up dynamic intensity in App.tsx**

In App.tsx, after the render sync effect, add a call to `audio.setIntensity`:
Find the effect at line 367-380 (sync render). After it, add:
```typescript
useEffect(() => {
  audio.setIntensity(state.score, state.levelIndex, state.speedMs, newRecord);
}, [state.score, state.levelIndex, state.speedMs, newRecord]);
```

---

### Task 3: Build and copy to monorepo

- [ ] **Step 1: Build**

Run `npm run build` from `build-classic-snake-game-game-development/`

- [ ] **Step 2: Copy dist to monorepo**

```bash
Copy-Item -Recurse -Force "dist/*" "../../serpentix/"
```

- [ ] **Step 3: Update index.html in monorepo**

Ensure the copied `serpentix/index.html` has the correct meta tags.

- [ ] **Step 4: Verify in browser**

Run `npx serve ../../serpentix/` and open http://localhost:3000 to verify music plays and name is "Serpentix".
