# Personal website — version 2

Dark, typographic research portfolio inspired by the visual direction of https://www.hontran.dev/: large condensed type, a monochrome dotted portrait, monospace labels, and subtle motion. Original markup and styling; only the owner's approved content and photograph are used.

- New preview: https://tterumiimurett.github.io/preview/v2/
- Editor: https://tterumiimurett.github.io/preview/v2/?edit=1
- Archived V1: https://tterumiimurett.github.io/archive/v1/
- Original preview remains at https://tterumiimurett.github.io/preview/

Edit content.js to change biography, papers, education, experience, personal interests and blog entries. The inline editor exports content.js; publishing requires updating preview/v2/content.js in GitHub. V2 has an independent content file, so later changes do not modify V1.

The portrait uses an independently implemented WebGL point renderer informed by inspection of the public reference site's interaction. A slowly following cursor center carries a velocity-driven flow: particles move along the stroke and fan to either side, with stable per-particle variation. A small radial crest rides on this flow. Motion naturally settles into subtle ripples as velocity and stroke energy decay, rather than switching between separate moving and resting engines. There are no accumulated wave sources, particle collisions, or artificially stretched ring contours.

The same local interaction intensity drives particle displacement, diameter and highlight. Photograph luminance sets the base halftone size; ambient wave crests modulate size and brightness, especially on fine dots. Fine dots fade with ambient waves and reappear under interaction. The ambient wave never switches off. A half-resolution separable bloom pass and linear-to-display conversion give lit dots a soft glow. Bloom falls back to direct particle rendering if framebuffer setup fails. This adapts the reference mechanism to the owner's photograph and existing layout; it is not a pixel-identical copy of the reference's full multi-stage scene or postprocessing stack.

Animation renders on every browser animation frame rather than using a fixed millisecond gate. Pointer velocity is measured from input timestamps, including coalesced samples when available, and filtered independently of display refresh rate. Brief gaps between input events retain the measured velocity; inactivity transitions into gradual momentum decay. This avoids event-rate-dependent surges and skipped high-refresh frames.

The source photograph is unchanged. Motion OFF and reduced-motion preferences use a static CSS dotted portrait. Animation stops when the hero is offscreen or the tab is hidden. Unsupported WebGL, lost graphics contexts, and cross-origin images fall back to the CSS portrait. No microphone, tracking, or audio is used. Pointer movement does not prevent touch scrolling.

Berkeley course projects are excluded; the exchange education entry remains. proactive FD-benchmark stays unpublished. No email address or resume download is published.

Typography experiment: headings use Smiley Sans (得意黑) v2.0.1 from https://github.com/atelier-anchor/smiley-sans. The unmodified official WOFF2 file is self-hosted in fonts/, with its SIL Open Font License in fonts/OFL.txt. Its built-in slant is preserved; synthetic bold and italic are disabled for headings. Manrope body text and IBM Plex Mono labels retain readability and load from Google Fonts with local fallbacks. Wave and pointer behavior are unchanged.

The pre-font-change V2 snapshot, including its interactive and idle waves, is preserved at https://tterumiimurett.github.io/archive/v2-idle/. The ORIGINAL links open this snapshot for comparison. A full local copy and ZIP are stored alongside this project as personal-site-v2-idle-2026-10-04.

Plain HTML/CSS/JavaScript, compatible with GitHub Pages.
