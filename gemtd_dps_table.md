# Gem DPS Reference Table — v0.17.0

## Methodology

- **Range (px)** = range_stat × (16/15)
- **Enemy speed** = 48 px/s (standard, waves 1–25)
- **Time in range** = 2 × range_px / effective_speed (straight line through gem center)
- **Attacks landed** = floor(time × atk_spd)
- **Slowed speed** = 48 × (1 − slow%)
- **Emerald/Jade DoT** = dps × (time_in_range + duration)
- **Ruby splash** = primary × (1 + dmgMod), assuming 1 splash target
- **Diamond crit** = avg_dmg × (1 + chance × (multiplier − 1))
- **Topaz/Malachite multi** = avg_dmg × targets, assuming all targets hit
- **Burn aura** = auraDps × time_in_aura_range
- **Nova splash** = hits × novaChance × novaDmgMod × avg_dmg (1 extra target)
- **Stun** = iterative: expected extra time = hits × stunChance × stunDuration
- **Armor not applied** (raw damage only)

---

## Base Gems — Level 1

### Emerald (Poison: DoT + Slow)

| Quality  | Avg dmg | Spd  | Range | Slow | Time  | Hits | Direct | DoT  | Total |
|----------|---------|------|-------|------|-------|------|--------|------|-------|
| Chipped  | 5       | 1.25 | 77    | 10%  | 3.6s  | 4    | 20     | 13   | 33    |
| Flawed   | 11      | 1.0  | 84    | 15%  | 4.1s  | 4    | 44     | 24   | 68    |
| Standard | 19.5    | 1.0  | 92    | 20%  | 4.8s  | 4    | 78     | 49   | 127   |
| Flawless | 33.5    | 1.0  | 107   | 25%  | 5.9s  | 5    | 168    | 95   | 263   |
| Perfect  | 84.5    | 1.0  | 122   | 30%  | 7.2s  | 7    | 592    | 244  | 836   |

### Ruby (Splash: +1 target at dmgMod%)

| Quality  | Avg dmg | dmgMod | Range | Time  | Hits | Primary | +Splash | Total |
|----------|---------|--------|-------|-------|------|---------|---------|-------|
| Chipped  | 8       | 20%    | 122   | 5.1s  | 5    | 40      | 8       | 48    |
| Flawed   | 14      | 25%    | 122   | 5.1s  | 5    | 70      | 18      | 88    |
| Standard | 19.5    | 30%    | 122   | 5.1s  | 5    | 98      | 29      | 127   |
| Flawless | 41      | 35%    | 122   | 5.1s  | 5    | 205     | 72      | 277   |
| Perfect  | 111     | 50%    | 138   | 5.7s  | 5    | 555     | 278     | 833   |

### Sapphire (Slow)

| Quality  | Avg dmg | Range | Slow | Time   | Hits | Total |
|----------|---------|-------|------|--------|------|-------|
| Chipped  | 6       | 77    | 20%  | 4.0s   | 4    | 24    |
| Flawed   | 11      | 99    | 25%  | 5.5s   | 5    | 55    |
| Standard | 18      | 122   | 30%  | 7.2s   | 7    | 126   |
| Flawless | 34.5    | 130   | 35%  | 8.3s   | 8    | 276   |
| Perfect  | 67      | 192   | 40%  | 13.3s  | 13   | 871   |

### Amethyst (Air only)

| Quality  | Avg dmg | Spd  | Range | Time  | Hits | Total |
|----------|---------|------|-------|-------|------|-------|
| Chipped  | 10.5    | 1.25 | 153   | 6.4s  | 7    | 74    |
| Flawed   | 21      | 1.0  | 172   | 7.2s  | 7    | 147   |
| Standard | 34.5    | 1.0  | 191   | 8.0s  | 7    | 242   |
| Flawless | 67      | 1.0  | 198   | 8.3s  | 8    | 536   |
| Perfect  | 144.5   | 1.0  | 229   | 9.6s  | 9    | 1301  |

### Diamond (Crit, ground only)

| Quality  | Avg dmg | Crit              | Eff avg | Range | Time  | Hits | Total |
|----------|---------|-------------------|---------|-------|-------|------|-------|
| Chipped  | 9.5     | 25% ×2.0 → ×1.25 | 11.9    | 77    | 3.2s  | 4    | 48    |
| Flawed   | 16.5    | 25% ×2.5 → ×1.38 | 22.7    | 84    | 3.5s  | 3    | 68    |
| Standard | 33      | 25% ×3.0 → ×1.50 | 49.5    | 92    | 3.8s  | 3    | 149   |
| Flawless | 61      | 30% ×3.0 → ×1.60 | 97.6    | 99    | 4.1s  | 4    | 390   |
| Perfect  | 126.5   | 33% ×3.5 → ×1.83 | 230.9   | 114   | 4.8s  | 4    | 923   |

### Topaz (Multi-target, all targets hit)

| Quality  | Avg dmg | Spd  | Targets | Range | Time  | Hits | Total  |
|----------|---------|------|---------|-------|-------|------|--------|
| Chipped  | 3.5     | 1.25 | 2       | 77    | 3.2s  | 4    | 28     |
| Flawed   | 7.5     | 1.0  | 3       | 77    | 3.2s  | 3    | 68     |
| Standard | 13.5    | 1.0  | 3       | 77    | 3.2s  | 3    | 122    |
| Flawless | 24.5    | 1.0  | 4       | 77    | 3.2s  | 3    | 294    |
| Perfect  | 67.5    | 1.0  | 5       | 85    | 3.6s  | 3    | 1013   |

### Aquamarine (Rapid fire)

| Quality  | Avg dmg | Spd  | Range | Time  | Hits | Total |
|----------|---------|------|-------|-------|------|-------|
| Chipped  | 6.5     | 2.70 | 53    | 2.2s  | 6    | 39    |
| Flawed   | 13      | 2.75 | 55    | 2.3s  | 6    | 78    |
| Standard | 26.5    | 2.80 | 58    | 2.4s  | 6    | 159   |
| Flawless | 51      | 2.85 | 65    | 2.7s  | 7    | 357   |
| Perfect  | 104     | 2.90 | 84    | 3.5s  | 10   | 1040  |

### Opal (Aura — direct damage only)

| Quality  | Avg dmg | Spd  | Aura   | Range | Time  | Hits | Total |
|----------|---------|------|--------|-------|-------|------|-------|
| Chipped  | 4.5     | 1.25 | +10%   | 92    | 3.8s  | 4    | 18    |
| Flawed   | 9.5     | 1.0  | +15%   | 107   | 4.4s  | 4    | 38    |
| Standard | 19.5    | 1.0  | +20%   | 122   | 5.1s  | 5    | 98    |
| Flawless | 39.5    | 1.0  | +25%   | 138   | 5.7s  | 5    | 198   |
| Perfect  | 84.5    | 1.0  | +35%   | 153   | 6.4s  | 6    | 507   |

---

## Base Gems — Level 1 Summary

| Quality  | Emerald | Ruby | Sapphire | Amethyst | Diamond | Topaz | Aquamarine | Opal |
|----------|---------|------|----------|----------|---------|-------|------------|------|
| Chipped  | 33      | 48   | 24       | 74       | 48      | 28    | 39         | 18   |
| Flawed   | 68      | 88   | 55       | 147      | 68      | 68    | 78         | 38   |
| Standard | 127     | 127  | 126      | 242      | 149     | 122   | 159        | 98   |
| Flawless | 263     | 277  | 276      | 536      | 390     | 294   | 357        | 198  |
| Perfect  | 836     | 833  | 871      | 1301     | 923     | 1013  | 1040       | 507  |

---

## Special Gems — Level 1

### Jade Chain (Poison + Slow)

| Gem              | Avg dmg | Spd  | Range | Slow | Time  | Hits | Direct | DoT  | Total |
|------------------|---------|------|-------|------|-------|------|--------|------|-------|
| Jade             | 32      | 2.0  | 122   | 20%  | 6.3s  | 12   | 384    | 32   | 416   |
| Asian Jade       | 49.5    | 2.0  | 122   | 30%  | 7.2s  | 14   | 693    | 72   | 765   |
| Lucky Asian Jade | 54.5    | 2.85 | 130   | 40%  | 9.0s  | 25   | 1567   | 90   | 1657  |

Lucky Asian Jade also has 5% crit ×4 (included in direct), 1% stun, 5% gold proc.

### Malachite Chain (Multi-target)

| Gem               | Avg dmg | Spd  | Range | Targets | Time  | Hits | Total  |
|-------------------|---------|------|-------|---------|-------|------|--------|
| Malachite         | 5.5     | 2.86 | 114   | 3       | 4.8s  | 13   | 215    |
| Vivid Malachite   | 10.5    | 2.86 | 122   | 4       | 5.1s  | 14   | 588    |
| Mighty Malachite  | 44.5    | 2.86 | 122   | 10      | 5.1s  | 14   | 6230   |

### Silver Chain (Splash + Slow)

| Gem             | Avg dmg | Spd | Range | Slow | Splash | Time  | Hits | Direct | +Splash | Total |
|-----------------|---------|-----|-------|------|--------|-------|------|--------|---------|-------|
| Silver          | 22      | 1.0 | 92    | 15%  | 30%    | 4.5s  | 4    | 88     | 26      | 114   |
| Sterling Silver | 39.5    | 1.0 | 99    | 25%  | 40%    | 5.5s  | 5    | 198    | 79      | 277   |
| Silver Knight   | 149.5   | 1.0 | 114   | 35%  | 50%    | 7.3s  | 7    | 1047   | 523     | 1570  |

### Star Ruby Chain (Burn Aura)

| Gem               | Avg dmg | Spd | Range | Burn DPS | Time  | Hits | Direct | Burn | Total |
|-------------------|---------|-----|-------|----------|-------|------|--------|------|-------|
| Star Ruby         | 10.5    | 4.0 | 41    | 40       | 1.7s  | 6    | 63     | 68   | 131   |
| Blazing Star Ruby | 15.5    | 4.0 | 47    | 65       | 2.0s  | 7    | 109    | 127  | 236   |
| Grand Star Ruby   | 24.5    | 4.0 | 55    | 100      | 2.3s  | 9    | 221    | 231  | 452   |

### Red Crystal Chain (Air only + Armor Aura)

| Gem                 | Avg dmg | Spd  | Range | Time  | Hits | Direct | Armor Aura        |
|---------------------|---------|------|-------|-------|------|--------|-------------------|
| Red Crystal         | 62      | 1.25 | 198   | 8.3s  | 10   | 620    | −12% to flying    |
| Red Crystal Facet   | 87      | 1.25 | 213   | 8.9s  | 11   | 957    | −15% to flying    |
| Rose Quartz Crystal | 112     | 1.25 | 229   | 9.6s  | 11   | 1232   | −18% to flying    |

### Pink Diamond Chain (Ground only + Crit)

| Gem                | Avg dmg | Spd   | Crit               | Eff avg | Range | Time  | Hits | Total |
|--------------------|---------|-------|--------------------|---------|-------|-------|------|-------|
| Pink Diamond       | 162     | 1.0   | 15% ×6 → ×1.75    | 283.5   | 122   | 5.1s  | 5    | 1418  |
| Great Pink Diamond | 184.5   | 1.538 | 15% ×10 → ×2.35   | 433.6   | 130   | 5.4s  | 8    | 3469  |

### Gold Chain (Crit + Armor Debuff)

| Gem           | Avg dmg | Spd   | Crit               | Eff avg | Range | Hits | Total | Armor Debuff |
|---------------|---------|-------|--------------------|---------|-------|------|-------|--------------|
| Gold          | 174.5   | 1.0   | 25% ×3 → ×1.50    | 261.8   | 122   | 5    | 1309  | −15% for 3s  |
| Egyptian Gold | 179.5   | 1.429 | 30% ×3 → ×1.60    | 287.2   | 122   | 7    | 2010  | −24% for 3s  |

### Paraiba Tourmaline Chain (Ground Armor Aura + Nova)

| Gem                      | Avg dmg | Spd   | Range | Hits | Direct | Nova | Total | Armor Aura     |
|--------------------------|---------|-------|-------|------|--------|------|-------|----------------|
| Paraiba Tourmaline       | 65      | 1.333 | 130   | 7    | 455    | 75   | 530   | −12% to ground |
| Paraiba Tourmaline Facet | 164.5   | 1.667 | 138   | 9    | 1481   | 366  | 1847  | −18% to ground |

Nova: 33% chance per hit, 50%/75% damage to 1 extra target.

### Black Opal Chain (Damage Aura — support)

| Gem               | Avg dmg | Spd | Range | Hits | Direct | Dmg Aura            |
|-------------------|---------|-----|-------|------|--------|---------------------|
| Black Opal        | 24.5    | 1.0 | 122   | 5    | 123    | +30% to nearby gems |
| Mystic Black Opal | 49.5    | 1.0 | 153   | 6    | 297    | +40% to nearby gems |

### Dark Emerald Chain (Stun)

| Gem               | Avg dmg | Spd   | Range | Stun          | Eff Time | Hits | Total |
|-------------------|---------|-------|-------|---------------|----------|------|-------|
| Dark Emerald      | 119.5   | 1.25  | 84    | 12.5% for 1s  | 4.1s     | 5    | 598   |
| Enchanted Emerald | 149     | 1.429 | 107   | 15% for 2s    | 7.4s     | 10   | 1490  |

Stun extends effective time in range (iterative calculation).

### Yellow Sapphire Chain (Splash + Slow)

| Gem                  | Avg dmg | Spd | Range | Slow | Splash | Time  | Hits | Direct | +Splash | Total |
|----------------------|---------|-----|-------|------|--------|-------|------|--------|---------|-------|
| Yellow Sapphire      | 114.5   | 1.1 | 122   | 30%  | 50%    | 7.2s  | 7    | 802    | 401     | 1203  |
| Star Yellow Sapphire | 114.5   | 1.1 | 122   | 40%  | 100%   | 8.4s  | 9    | 1031   | 1031    | 2062  |

Star Yellow Sapphire also provides +5% damage aura to nearby gems.

### Blood Stone Chain

| Gem                 | Avg dmg | Spd   | Range | Time  | Hits | Direct | Effect | Total | Notes                                  |
|---------------------|---------|-------|-------|-------|------|--------|--------|-------|----------------------------------------|
| Blood Stone         | 67.5    | 2.0   | 107   | 4.4s  | 8    | 2700   | 600    | 3300  | 5 targets + 135 burn DPS               |
| Ancient Blood Stone | 199.5   | 1.333 | 107   | 4.4s  | 5    | 1446   | 1752   | 3198  | 15% crit ×4, 75% splash, 150 burn DPS |

### Uranium Chain (Slow Aura + Burn Aura)

| Gem          | Avg dmg | Spd | Range | Slow | Burn DPS | Time  | Hits | Direct | Burn  | Total |
|--------------|---------|-----|-------|------|----------|-------|------|--------|-------|-------|
| Uranium 235  | 47.5    | 4.0 | 68    | 40%  | 190      | 4.7s  | 18   | 855    | 901   | 1756  |
| Uranium 238  | 64.5    | 4.0 | 92    | 50%  | 260      | 7.6s  | 30   | 1935   | 1988  | 3923  |

---

## Special Gems — Summary (sorted by single-target total)

| Gem                      | Total | Type                          |
|--------------------------|-------|-------------------------------|
| Mighty Malachite         | 6230  | 10 multi-target               |
| Blood Stone              | 3300  | 5 multi-target + burn         |
| Uranium 238              | 3923  | Slow aura + burn aura         |
| Great Pink Diamond       | 3469  | Ground crit                   |
| Ancient Blood Stone      | 3198  | Crit + splash + burn          |
| Star Yellow Sapphire     | 2062  | Splash + slow + dmg aura      |
| Egyptian Gold            | 2010  | Crit + armor debuff           |
| Paraiba Tourmaline Facet | 1847  | Nova + armor aura             |
| Lucky Asian Jade         | 1657  | Poison + slow + crit + gold   |
| Silver Knight            | 1570  | Splash + slow                 |
| Enchanted Emerald        | 1490  | Stun                          |
| Pink Diamond             | 1418  | Ground crit                   |
| Gold                     | 1309  | Crit + armor debuff           |
| Rose Quartz Crystal      | 1232  | Air only + armor aura         |
| Yellow Sapphire          | 1203  | Splash + slow                 |
| Red Crystal Facet        | 957   | Air only + armor aura         |
| Asian Jade               | 765   | Poison + slow                 |
| Red Crystal              | 620   | Air only + armor aura         |
| Dark Emerald             | 598   | Stun                          |
| Vivid Malachite          | 588   | 4 multi-target                |
| Paraiba Tourmaline       | 530   | Nova + armor aura             |
| Grand Star Ruby          | 452   | Burn aura                     |
| Jade                     | 416   | Poison + slow                 |
| Mystic Black Opal        | 297   | +40% dmg aura (support)       |
| Sterling Silver          | 277   | Splash + slow                 |
| Blazing Star Ruby        | 236   | Burn aura                     |
| Malachite                | 215   | 3 multi-target                |
| Star Ruby                | 131   | Burn aura                     |
| Black Opal               | 123   | +30% dmg aura (support)       |
| Silver                   | 114   | Splash + slow                 |

---

## Base Gems — Level 10

Gems gain a level every 10 kills. Each level gives +10% base damage.

### Per-Level Effect Scaling (v0.17.0)

| Gem        | Effect scaled  | Rate per level | At level 10 |
|------------|----------------|----------------|-------------|
| Emerald    | DoT dps        | +1 dps         | +9 dps      |
| Ruby       | Splash radius  | +0.1 tiles     | +0.9 tiles  |
| Sapphire   | Range          | +0.1 tiles     | +0.9 tiles  |
| Amethyst   | Range          | +0.5 tiles     | +4.5 tiles  |
| Diamond    | Crit chance    | +1%            | +9%         |
| Diamond    | Crit mult      | +0.1×          | +0.9×       |
| Topaz      | Range          | +0.1 tiles     | +0.9 tiles  |
| Aquamarine | Attack speed   | +0.025         | +0.225      |
| Aquamarine | Range          | +0.1 tiles     | +0.9 tiles  |
| Opal       | Aura bonus     | +1%            | +9%         |

**Removed in v0.17.0:** Ruby dmgMod scaling, Sapphire slow/duration scaling, Topaz target scaling, Emerald slow scaling.

### Level 10 Summary

| Quality  | Emerald | Ruby | Sapphire | Amethyst | Diamond | Topaz | Aquamarine | Opal |
|----------|---------|------|----------|----------|---------|-------|------------|------|
| Chipped  | 112     | 96   | 48       | 231      | 125     | 56    | 104        | 36   |
| Flawed   | 186     | 175  | 132      | 420      | 180     | 135   | 208        | 76   |
| Standard | 293     | 254  | 288      | 690      | 393     | 243   | 477        | 195  |
| Flawless | 538     | 554  | 621      | 1474     | 1040    | 588   | 1020       | 395  |
| Perfect  | 1564    | 1665 | 1876     | 3468     | 2457    | 2700  | 2496       | 1014 |

### L1 → L10 Multiplier

| Quality  | Emerald | Ruby | Sapphire | Amethyst | Diamond | Topaz | Aquamarine | Opal |
|----------|---------|------|----------|----------|---------|-------|------------|------|
| Chipped  | 3.4×    | 2.0× | 2.0×    | 3.1×     | 2.6×    | 2.0×  | 2.7×       | 2.0× |
| Flawed   | 2.7×    | 2.0× | 2.4×    | 2.9×     | 2.6×    | 2.0×  | 2.7×       | 2.0× |
| Standard | 2.3×    | 2.0× | 2.3×    | 2.9×     | 2.6×    | 2.0×  | 3.0×       | 2.0× |
| Flawless | 2.0×    | 2.0× | 2.3×    | 2.8×     | 2.7×    | 2.0×  | 2.9×       | 2.0× |
| Perfect  | 1.9×    | 2.0× | 2.2×    | 2.7×     | 2.7×    | 2.7×  | 2.4×       | 2.0× |

---

## Special Gems — Level 10 (final tier only)

All special gems scale +10% damage and +0.1 tile range per level. Additional per-type scaling listed below.

### Per-Level Effect Scaling (Special Gems)

| Chain | Extra scaling per level |
|-------|----------------------|
| Jade chain | poison dps +1 |
| Lucky Asian Jade | poison dps +1, crit chance +0.5%, crit mult +0.1, stun chance +0.1% |
| Malachite | attack speed +0.02 |
| Silver | splash radius +0.1t, splash dmg% +1% (uncapped) |
| Star Ruby / Blood Stone / ABS / Uranium | burn DPS +2, aura range +0.1t |
| Red Crystal | armor aura +0.6% reduction, aura range +0.1t |
| Pink Diamond | crit chance +1%, crit mult +0.1 |
| Gold | crit chance +1%, crit mult +0.1, armor debuff +0.6% reduction |
| Paraiba | ground armor +0.6% reduction, aura range +0.1t, nova radius +0.1t |
| Black Opal | dmg aura +1%, aura range +0.1t |
| Dark Emerald | stun chance +0.2% |
| Yellow Sapphire | splash radius +0.1t, splash dmg% +1% (uncapped) |
| Star Yellow Sapphire | splash radius +0.1t, splash dmg% +1% (uncapped), dmg aura +1%, dmg aura range +0.1t |
| Ancient Blood Stone | crit chance +1%, crit mult +0.1, splash radius +0.1t, burn DPS +2, aura range +0.1t |

### Level 10 Summary (sorted by L10 total)

| Gem                      | L1 Total | L10 Total | L1→L10 | Notes |
|--------------------------|----------|-----------|--------|-------|
| Mighty Malachite         | 6,230    | 14,374    | 2.31×  | 10 targets; +atk spd scaling |
| Great Pink Diamond       | 3,469    | 10,651    | 3.07×  | Crit chance + mult double-stack |
| Ancient Blood Stone      | 3,198    | 8,552     | 2.67×  | Crit + splash + burn all scale |
| Uranium 238              | 3,922    | 6,748     | 1.72×  | Burn DPS barely scales vs base |
| Egyptian Gold            | 2,010    | 5,814     | 2.89×  | Crit double-stack + armor debuff |
| Lucky Asian Jade         | 1,657    | 4,688     | 2.83×  | Poison + crit + stun compound |
| Star Yellow Sapphire     | 2,062    | 4,548     | 2.21×  | Uncapped splash scales past 100% |
| Paraiba Tourmaline Facet | 1,847    | 3,900     | 2.11×  | Nova + range scaling |
| Silver Knight            | 1,570    | 3,408     | 2.17×  | Extra hit from range × splash |
| Enchanted Emerald        | 1,490    | 3,397     | 2.28×  | Stun feedback loop grows |
| Rose Quartz Crystal      | 1,232    | 2,554     | 2.07×  | Air only; 23% armor aura at L10 |
| Grand Star Ruby          | 452      | 855       | 1.89×  | Short range limits scaling |
| Mystic Black Opal        | 297      | 564       | 1.90×  | Support; +49% dmg aura at L10 |

---

## Notes

**Base gems:**
- Amethyst is air-only; its high numbers apply only to flying enemy waves
- Diamond is ground-only; compensated by strong crit scaling
- Opal's combat value is low by design — the aura (+10–35% atk spd) is its primary contribution
- Sapphire's high Perfect numbers reflect extreme time-in-range from combined range + slow
- Ruby and Opal scale exactly 2.0× (only damage doubles; effects don't change hit count)
- Topaz Perfect jumps to 2.7× at L10 because range scaling grants an extra attack across all 5 targets

**Special gems:**
- Mighty Malachite and Blood Stone are the AoE kings (6000+) but require 10 targets in range
- Uranium 238 is the strongest sustained single-target gem (3923) thanks to slow aura keeping enemies in the burn zone
- Great Pink Diamond is the strongest burst ground gem (3469) from massive crit scaling
- Support gems (Black Opal, Red Crystal, Paraiba) have low personal damage but provide team-wide aura value not captured here
- Enchanted Emerald's stun creates a feedback loop: more hits → more stuns → more time → more hits
- Blood Stone (6000) vs Mighty Malachite (6230): Blood Stone adds burn damage and scales better with fewer enemies since burn aura hits all in range regardless
