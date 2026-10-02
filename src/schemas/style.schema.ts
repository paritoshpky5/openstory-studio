import { z } from 'zod';

export const StyleBibleSchema = z.object({
  masterStylePrompt: z.string().min(10, 'Master style prompt must be detailed'),
  characterStyle: z.string().min(5, 'Character style description required'),
  lightingStyle: z.string().min(5, 'Lighting style description required'),
  renderStyle: z.string().min(5, 'Render style description required'),
  environmentStyle: z.string().min(5, 'Environment style description required'),
  colorLanguage: z.string().min(5, 'Color language description required'),
  cameraStyle: z.string().min(5, 'Camera style description required'),
  lensStyle: z.string().min(3, 'Lens style description required'),
  depthOfFieldStyle: z.string().min(3, 'Depth of field description required'),
  animationStyle: z.string().min(5, 'Animation style description required'),
  materialStyle: z.string().min(5, 'Material style description required'),
  negativePrompt: z.string().default('photorealistic human live-action, 2D anime, flat shading, low poly, oversaturated, amateur CGI, watermark, blurry, deformed'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '2.39:1']).default('16:9'),
  fps: z.number().int().min(12).max(60).default(24),
  isLocked: z.boolean().default(false),
  lockedAt: z.string().datetime().optional().nullable(),
});

export type StyleBibleInput = z.infer<typeof StyleBibleSchema>;

export const DEFAULT_HINDI_CINEMATIC_STYLE: StyleBibleInput = {
  masterStylePrompt: 'Polished cinematic stylized 3D animated film aesthetic, rich Indian narrative cinema, detailed cloth micro-textures, expressive Indian character design, soft cinematic global illumination, physically plausible rim lighting and bounce light, controlled shallow depth of field, premium feature-animation composition.',
  characterStyle: 'Stylized 3D animated Indian characters with expressive facial features, lifelike skin subsurface scattering without photorealism uncanny valley, anatomically proportioned with gentle animated stylization.',
  lightingStyle: 'Cinematic three-point lighting with warm key light, soft atmospheric bounce, golden hour rim accents, and deep volumetric village/interior atmosphere.',
  renderStyle: 'Stylized octane render aesthetic, soft shadows, raytraced ambient occlusion, subsurface scattering on skin, high-end 3D animated feature film look.',
  environmentStyle: 'Richly detailed Indian settings, weathered terracotta textures, earthen walls, vibrant handwoven textiles, authentic regional flora, atmospheric dust motes in sunbeams.',
  colorLanguage: 'Harmonious warm palette dominated by ochre, deep saffron, terracotta, marigold, indigo, and forest greens, with controlled cinematic color grading.',
  cameraStyle: 'Deliberate cinematic camera placement, eye-level intimate framing, slow dolly and tracking movements, avoiding rapid or jarring movements.',
  lensStyle: '50mm and 85mm prime cinema lenses for character close-ups; 28mm for establishing vistas.',
  depthOfFieldStyle: 'Shallow depth of field with creamy bokeh, isolating character emotional expressions from background elements.',
  animationStyle: 'Weighty natural human movement, subtle facial micro-expressions, breathing cycles, authentic cultural gestures (namaste, head tilts, expressive hand movements).',
  materialStyle: 'Tactile cotton, silk, khadi, weathered brass, clay pottery, carved teak wood, physical roughness maps.',
  negativePrompt: 'photorealistic human live-action, 2D flat cartoon, anime eyes, low poly, plastic skin, oversaturated neon, amateur CGI, text watermark, blurry, extra limbs, distorted hands, morphing clothes.',
  aspectRatio: '16:9',
  fps: 24,
  isLocked: false,
};
