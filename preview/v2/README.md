# Personal website — version 2

Dark, typographic research portfolio inspired by the visual direction of https://www.hontran.dev/: large condensed type, a monochrome dotted portrait, monospace labels, and subtle motion. Original markup and styling; only the owner's approved content and photograph are used.

- New preview: https://tterumiimurett.github.io/preview/v2/
- Editor: https://tterumiimurett.github.io/preview/v2/?edit=1
- Archived V1: https://tterumiimurett.github.io/archive/v1/
- Original preview remains at https://tterumiimurett.github.io/preview/

Edit content.js to change biography, papers, education, experience, personal interests and blog entries. The inline editor exports content.js; publishing requires updating preview/v2/content.js in GitHub. V2 has an independent content file, so later changes do not modify V1.

The portrait uses an independently written WebGL point-particle renderer with three independent layers: a continuous subtle ambient wave; a radial repulsion field while the pointer moves; and concentric ripples centered at the pointer after it rests for 0.25 seconds. The ambient layer never switches off during interaction. Moving and resting effects crossfade; moving no longer emits travelling wakes. Leaving the hero fades the pointer layers away, leaving the ambient wave. Input smoothing and rendering remain refresh-rate independent. This is an original implementation of the requested visual behavior, not a copy of the reference site's assets or code.

Animation renders on every browser animation frame rather than using a fixed millisecond gate. Pointer velocity is measured from input timestamps, including coalesced samples when available, and filtered independently of display refresh rate. Brief gaps between input events retain the measured velocity; inactivity transitions into gradual momentum decay. This avoids event-rate-dependent surges and skipped high-refresh frames.

The source photograph is unchanged. Motion OFF and reduced-motion preferences use a static CSS dotted portrait. Animation stops when the hero is offscreen or the tab is hidden. Unsupported WebGL, lost graphics contexts, and cross-origin images fall back to the CSS portrait. No microphone, tracking, or audio is used. Pointer movement does not prevent touch scrolling.

Berkeley course projects are excluded; the exchange education entry remains. proactive FD-benchmark stays unpublished. No email address or resume download is published.

Typography experiment: headings use Smiley Sans (得意黑) v2.0.1 from https://github.com/atelier-anchor/smiley-sans. The unmodified official WOFF2 file is self-hosted in fonts/, with its SIL Open Font License in fonts/OFL.txt. Its built-in slant is preserved; synthetic bold and italic are disabled for headings. Manrope body text and IBM Plex Mono labels retain readability and load from Google Fonts with local fallbacks. Wave and pointer behavior are unchanged.

The pre-font-change V2 snapshot, including its interactive and idle waves, is preserved at https://tterumiimurett.github.io/archive/v2-idle/. The ORIGINAL links open this snapshot for comparison. A full local copy and ZIP are stored alongside this project as personal-site-v2-idle-2026-10-04.

Plain HTML/CSS/JavaScript, compatible with GitHub Pages.

Fine dots now fade in and out with the ambient wave and are revealed locally by pointer movement, including at the pointer center. Larger portrait dots retain their opacity. Moving bands use a stable radius, gentler displacement and a small velocity-aligned deformation and drift rather than rigid speed-scaled circles. No particle collision simulation or accumulated wave sources are used.

Particle refinement: the moving field uses cursor-relative concentric bands, without emitting separate wakes or simulating collisions. Stationary ripples have reduced displacement and brightness and travel more slowly. Dot diameter follows photograph luminance with subtle ambient and interaction modulation, bounded to 12–98% of grid spacing. Dark areas carry finer dots and bright areas larger dots; wave crests gently change their size. The ambient wave remains independent and always present while motion is enabled.
