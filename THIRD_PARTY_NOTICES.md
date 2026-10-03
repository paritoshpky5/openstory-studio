# Third-Party Notices

This project incorporates portions of code and design patterns adapted from third-party open-source software under their respective licenses.

---

## OpenCut (opencut-classic)

Portions of timeline mathematics, snapping logic, ruler subdivisions, and canvas waveform rendering algorithms are adapted from **OpenCut Classic** (https://github.com/opencut-app/opencut-classic).

**License:** MIT License
**Copyright:** (c) 2024 OpenCut Contributors

### Adapted Files & Modules:
- `apps/web/src/timeline/scale.ts` -> adapted into `src/lib/timeline/timeline-math.ts`
- `apps/web/src/timeline/ruler-utils.ts` -> adapted into `src/lib/timeline/timeline-math.ts`
- `apps/web/src/timeline/snapping/` -> adapted into `src/lib/timeline/timeline-math.ts`
- `apps/web/src/timeline/components/audio-waveform.tsx` -> adapted into `src/components/studio/timeline/audio-waveform.tsx`
- `apps/web/src/core/managers/commands.ts` -> pattern adapted into `src/lib/timeline/timeline-commands.ts`

### MIT License Text:

```
MIT License

Copyright (c) 2024 OpenCut Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
