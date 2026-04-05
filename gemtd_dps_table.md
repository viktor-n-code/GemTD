# Gem DPS Reference Table — v0.8.6

## Methodology

- **Range (px)** = range_stat × (16/15)
- **Enemy speed** = 0.75 tiles/s × 64 px/tile = 48 px/s (standard, waves 1–25)
- **Time in range** = 2 × range_px / effective_speed (straight line through gem center)
- **Attacks landed** = floor(time × atk_spd)
- **Slowed speed** (Emerald/Sapphire) = 48 × (1 − slow%)
- **Emerald DoT** = dps × (time_in_range + duration) — starts on first hit, runs full duration after leaving range
- **Ruby** = primary × (1 + dmgMod) per hit, assuming 1 splash target hit
- **Diamond** = avg_dmg × (1 + chance × (multiplier − 1)) per hit
- **Topaz** = avg_dmg × targets per hit, assuming all targets hit
- **Armor not applied** (raw damage only)

---

## Per-Gem Breakdown

### Emerald (Poison: DoT + slow)

| Tier     | Avg dmg | Spd  | Range | Slow | Slowed spd | Time  | Hits | Direct | DoT          | Total |
|----------|---------|------|-------|------|------------|-------|------|--------|--------------|-------|
| Chipped  | 5       | 1.25 | 72    | 10%  | 43.2 px/s  | 3.6s  | 4    | 20     | 2×6.6 = 13   | 33    |
| Flawed   | 11      | 1.0  | 79    | 15%  | 40.8 px/s  | 4.1s  | 4    | 44     | 3×8.1 = 24   | 68    |
| Standard | 19.5    | 1.0  | 86    | 20%  | 38.4 px/s  | 4.8s  | 4    | 78     | 5×9.8 = 49   | 127   |
| Flawless | 33.5    | 1.0  | 100   | 25%  | 36.0 px/s  | 5.9s  | 5    | 168    | 8×11.9 = 95  | 263   |
| Perfect  | 84.5    | 1.0  | 114   | 30%  | 33.6 px/s  | 7.2s  | 7    | 592    | 16×15.2 = 244| 836   |

### Ruby (Splash: +1 target at dmgMod%)

| Tier     | Avg dmg | dmgMod | Range | Time  | Hits | Primary | +Splash | Total |
|----------|---------|--------|-------|-------|------|---------|---------|-------|
| Chipped  | 8       | 20%    | 114   | 5.1s  | 5    | 40      | 8       | 48    |
| Flawed   | 14      | 25%    | 114   | 5.1s  | 5    | 70      | 17.5    | 88    |
| Standard | 19.5    | 30%    | 114   | 5.1s  | 5    | 97.5    | 29      | 127   |
| Flawless | 41      | 35%    | 114   | 5.1s  | 5    | 205     | 72      | 277   |
| Perfect  | 111     | 50%    | 129   | 5.7s  | 5    | 555     | 277.5   | 833   |

### Sapphire (Slow)

| Tier     | Avg dmg | Range | Slow | Slowed spd | Time   | Hits | Total |
|----------|---------|-------|------|------------|--------|------|-------|
| Chipped  | 6       | 72    | 20%  | 38.4 px/s  | 4.0s   | 4    | 24    |
| Flawed   | 11      | 93    | 25%  | 36.0 px/s  | 5.5s   | 5    | 55    |
| Standard | 18      | 114   | 30%  | 33.6 px/s  | 7.2s   | 7    | 126   |
| Flawless | 34.5    | 122   | 35%  | 31.2 px/s  | 8.3s   | 8    | 276   |
| Perfect  | 67      | 180   | 40%  | 28.8 px/s  | 13.3s  | 13   | 871   |

### Amethyst (Air only)

| Tier     | Avg dmg | Spd  | Range | Time  | Hits | Total |
|----------|---------|------|-------|-------|------|-------|
| Chipped  | 10.5    | 1.25 | 143   | 6.4s  | 8    | 84    |
| Flawed   | 21      | 1.0  | 161   | 7.2s  | 7    | 147   |
| Standard | 34.5    | 1.0  | 179   | 8.0s  | 8    | 276   |
| Flawless | 67      | 1.0  | 186   | 8.3s  | 8    | 536   |
| Perfect  | 144.5   | 1.0  | 215   | 9.6s  | 9    | 1301  |

### Diamond (Crit, ground only)

| Tier     | Avg dmg | Crit               | Eff avg | Range | Time  | Hits | Total |
|----------|---------|--------------------|---------|-------|-------|------|-------|
| Chipped  | 9.5     | 25%×2.0 → ×1.25    | 11.9    | 72    | 3.2s  | 4    | 48    |
| Flawed   | 16.5    | 25%×2.5 → ×1.375   | 22.7    | 79    | 3.5s  | 3    | 68    |
| Standard | 33      | 25%×3.0 → ×1.50    | 49.5    | 86    | 3.8s  | 3    | 149   |
| Flawless | 61      | 30%×3.0 → ×1.60    | 97.6    | 93    | 4.1s  | 4    | 390   |
| Perfect  | 126.5   | 33%×3.5 → ×1.825   | 230.9   | 107   | 4.8s  | 4    | 924   |

### Topaz (Multi-target, all targets hit)

| Tier     | Avg dmg | Spd  | Targets | Range | Time  | Hits | Total |
|----------|---------|------|---------|-------|-------|------|-------|
| Chipped  | 3.5     | 1.25 | 2       | 72    | 3.2s  | 4    | 28    |
| Flawed   | 7.5     | 1.0  | 3       | 72    | 3.2s  | 3    | 68    |
| Standard | 13.5    | 1.0  | 3       | 72    | 3.2s  | 3    | 122   |
| Flawless | 24.5    | 1.0  | 4       | 72    | 3.2s  | 3    | 294   |
| Perfect  | 67.5    | 1.0  | 5       | 80    | 3.6s  | 3    | 1013  |

### Aquamarine (Rapid fire)

| Tier     | Avg dmg | Spd  | Range | Time  | Hits | Total |
|----------|---------|------|-------|-------|------|-------|
| Chipped  | 6.5     | 2.70 | 50    | 2.2s  | 6    | 39    |
| Flawed   | 13      | 2.75 | 52    | 2.3s  | 6    | 78    |
| Standard | 26.5    | 2.80 | 54    | 2.4s  | 6    | 159   |
| Flawless | 51      | 2.85 | 61    | 2.7s  | 7    | 357   |
| Perfect  | 104     | 2.90 | 79    | 3.5s  | 10   | 1040  |

### Opal (Aura — direct damage only, aura value excluded)

| Tier     | Avg dmg | Spd  | Aura bonus | Range | Time  | Hits | Total |
|----------|---------|------|------------|-------|-------|------|-------|
| Chipped  | 4.5     | 1.25 | +10%       | 86    | 3.8s  | 4    | 18    |
| Flawed   | 9.5     | 1.0  | +15%       | 100   | 4.4s  | 4    | 38    |
| Standard | 19.5    | 1.0  | +20%       | 114   | 5.1s  | 5    | 98    |
| Flawless | 39.5    | 1.0  | +25%       | 129   | 5.7s  | 5    | 198   |
| Perfect  | 84.5    | 1.0  | +35%       | 143   | 6.4s  | 6    | 507   |

---

## Summary — Effective Damage per Enemy (one straight-line pass)

| Tier     | Emerald | Ruby | Sapphire | Amethyst | Diamond | Topaz | Aquamarine | Opal |
|----------|---------|------|----------|----------|---------|-------|------------|------|
| Chipped  | 33      | 48   | 24       | 84       | 48      | 28    | 39         | 18   |
| Flawed   | 68      | 88   | 55       | 147      | 68      | 68    | 78         | 38   |
| Standard | 127     | 127  | 126      | 276      | 149     | 122   | 159        | 98   |
| Flawless | 263     | 277  | 276      | 536      | 390     | 294   | 357        | 198  |
| Perfect  | 836     | 833  | 871      | 1301     | 924     | 1013  | 1040       | 507  |

**Notes:**
- Amethyst is air-only; its high numbers apply only to flying enemy waves
- Diamond is ground-only; no utility upside, compensated by strong scaling crit
- Opal's combat value is low by design — the aura (+10–35% atk spd to nearby gems) is its primary contribution
- Sapphire's high perfect-tier number reflects extreme time-in-range (13.3s) from the combined range + slow effect
- Topaz and Aquamarine perfect values assume optimal placement (multiple targets in range / high attack count landing)
