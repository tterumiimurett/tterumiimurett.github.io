# Personal website — version 2

Dark, typographic research portfolio inspired by the visual direction of https://www.hontran.dev/: large condensed type, a monochrome dotted portrait, monospace labels, and subtle motion. Original markup and styling; only the owner's approved content and photograph are used.

- New preview: https://tterumiimurett.github.io/preview/v2/
- Editor: https://tterumiimurett.github.io/preview/v2/?edit=1
- Archived V1: https://tterumiimurett.github.io/archive/v1/
- Original preview remains at https://tterumiimurett.github.io/preview/

Edit content.js to change biography, papers, education, experience, personal interests and blog entries. The inline editor exports content.js; publishing requires updating preview/v2/content.js in GitHub. V2 has an independent content file, so later changes do not modify V1.

The portrait uses an independently written WebGL point-particle renderer. Each dot keeps its own photographic tone while moving with the cursor's direction and momentum, then settles back onto its home grid. A slower trailing cursor and exponential velocity decay give the motion a liquid feel; only a small crest accompanies the flow. Clicks and touch add one restrained pulse, not overlapping high-amplitude rings. At rest the field is still. The implementation follows motion principles observed in hontran.dev's publicly served frontend, without bundling its code or assets.

Animation renders on every browser animation frame rather than using a fixed millisecond gate. Pointer velocity is measured from input timestamps, including coalesced samples when available, and filtered independently of display refresh rate. Brief gaps between input events retain the measured velocity; inactivity transitions into gradual momentum decay. This avoids event-rate-dependent surges and skipped high-refresh frames.

The source photograph is unchanged. Motion OFF and reduced-motion preferences use a static CSS dotted portrait. Animation stops when the hero is offscreen or the tab is hidden. Unsupported WebGL, lost graphics contexts, and cross-origin images fall back to the CSS portrait. No microphone, tracking, or audio is used. Pointer movement does not prevent touch scrolling.

Berkeley course projects are excluded; the exchange education entry remains. proactive FD-benchmark stays unpublished. No email address or resume download is published.

Fonts load from Google Fonts with local fallbacks. Plain HTML/CSS/JavaScript, compatible with GitHub Pages.
