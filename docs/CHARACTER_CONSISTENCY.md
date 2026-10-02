# Character Consistency Architecture

Character consistency is the single most critical quality criterion in OpenStory Studio. Viewers instantly reject stories where characters morph between frames or wear differing clothes without narrative reason.

---

## 1. The Character Identity Package

Every recurring character must have an immutable `CharacterIdentityPackage`. The package breaks character traits down into discrete physical elements:

1. **Facial Structure**: Jawline, cheekbones, brow ridge, and nose shape.
2. **Skin Tone & Texture**: Consistent regional Indian skin tones (warm dusky, wheatish, deep copper) with natural subsurface scattering.
3. **Eyes & Gaze**: Color, eyelid crease, and expressive personality.
4. **Hair & Headwear**: Style, parting, texture, silvering, and turbans/dupattas.
5. **Body Proportions**: Height, posture, and build.
6. **Clothing Blueprint**: Specific garments, dye colors, textile weave, and folds.
7. **Accessories & Signifiers**: Distinctive markers like a kalava wrist thread, earthen clay smudge, brass amulet, or specific footwear.

---

## 2. Character Reference Hierarchy

To ground generation models, characters utilize a multi-tier reference hierarchy:

- **PRIMARY_FACE**: Approved master front/three-quarter portrait.
- **PRIMARY_FULL_BODY**: Master full-body standing pose showing complete attire and proportions.
- **FRONT / THREE_QUARTER / SIDE**: Turnaround poses for spatial awareness.
- **EMOTION REPERTOIRE**: Approved expressions (HAPPY, SAD, ANGRY, WORRIED, INTROSPECTIVE).

---

## 3. The Character Lock Principle

Once the user approves a character's reference assets and visual descriptors:

1. The character status changes to **LOCKED**.
2. Locked attributes cannot be changed silently by prompt variations.
3. Subsequent scene prompts inject both the character's positive `consistencyPrompt` and negative `negativeConsistencyPrompt`.
4. Production videos are generated via **Image-to-Video** anchored to the approved production frame, preserving facial identity without text-to-video hallucination.
