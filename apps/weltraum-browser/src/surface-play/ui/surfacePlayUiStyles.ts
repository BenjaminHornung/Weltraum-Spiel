export const SURFACE_PLAY_UI_STYLES = `
.surface-play-ui {
  --surface-play-cyan: #8debf0;
  --surface-play-cyan-dim: #57959a;
  --surface-play-amber: #f2b84b;
  --surface-play-red: #ff5f5f;
  --surface-play-graphite: rgba(5, 19, 18, 0.82);
  position: absolute;
  inset: 0;
  z-index: 18;
  color: #dcfbfa;
  font-family: "Bahnschrift", "DIN Alternate", "Arial Narrow", sans-serif;
  font-size: clamp(0.78rem, 0.55vw + 0.48rem, 1rem);
  line-height: 1.2;
  letter-spacing: 0.055em;
  pointer-events: none;
  text-shadow: 0 1px 2px #001113;
}

.surface-play-hud {
  position: absolute;
  inset: 0;
}

.surface-play-hud__panel {
  position: absolute;
  display: grid;
  gap: 0.28rem;
  inline-size: min(19rem, 28vw);
  padding: 0.65rem 0.85rem 0.72rem;
  border-inline-start: 2px solid var(--surface-play-cyan-dim);
  border-block-end: 1px solid rgba(87, 149, 154, 0.38);
  background: var(--surface-play-graphite);
  box-shadow: 0 0.35rem 1rem rgba(0, 6, 8, 0.28);
}

.surface-play-hud__location {
  inset-block-start: 1.25rem;
  inset-inline-start: 1.25rem;
}

.surface-play-hud__suit {
  inset-block-end: 1.25rem;
  inset-inline-start: 1.25rem;
}

.surface-play-hud__weapon {
  inset-block-end: 1.25rem;
  inset-inline-end: 1.25rem;
}

.surface-play-hud__title {
  color: var(--surface-play-cyan);
  font-size: 1.05em;
  letter-spacing: 0.12em;
}

.surface-play-hud__eyebrow,
.surface-play-hud__objective,
.surface-play-hud__state,
.surface-play-hud__cooldown,
.surface-play-hud__readiness-detail {
  font-size: 0.78em;
}

.surface-play-hud__objective {
  color: #c4dcda;
}

.surface-play-hud__meter-label {
  margin-block-start: 0.15rem;
  color: #a8c9c8;
  font-size: 0.72em;
}

.surface-play-hud__meter-value {
  font-variant-numeric: tabular-nums;
}

.surface-play-hud__meter {
  overflow: hidden;
  block-size: 0.38rem;
  border: 1px solid #2b5c61;
  background: #061114;
}

.surface-play-hud__meter-fill {
  display: block;
  block-size: 100%;
  max-inline-size: 100%;
  background: var(--surface-play-cyan);
}

.surface-play-hud__meter[data-tone="warning"] .surface-play-hud__meter-fill,
.surface-play-hud__weapon[data-status="cooldown"] .surface-play-hud__weapon-status,
.surface-play-hud__weapon[data-status="overheated"] .surface-play-hud__weapon-status,
.surface-play-hud__weapon[data-status="energy-low"] .surface-play-hud__weapon-status {
  color: var(--surface-play-amber);
  background-color: var(--surface-play-amber);
}

.surface-play-hud__meter[data-tone="critical"] .surface-play-hud__meter-fill {
  background: var(--surface-play-red);
}

.surface-play-hud__weapon-status {
  color: var(--surface-play-cyan);
  letter-spacing: 0.14em;
}

.surface-play-hud__weapon[data-status="cooldown"] .surface-play-hud__weapon-status,
.surface-play-hud__weapon[data-status="overheated"] .surface-play-hud__weapon-status,
.surface-play-hud__weapon[data-status="energy-low"] .surface-play-hud__weapon-status {
  background: transparent;
}

.surface-play-hud__center-safe {
  position: absolute;
  inset: 20% 28%;
  pointer-events: none;
}

.surface-play-hud__reticle {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  inline-size: 0.75rem;
  block-size: 0.75rem;
  border: 1px solid var(--surface-play-cyan);
  transform: translate(-50%, -50%) rotate(45deg);
  box-shadow: 0 0 0 1px rgba(0, 7, 9, 0.85);
}

.surface-play-hud__target {
  position: absolute;
  inset-inline-start: 50%;
  max-inline-size: 22rem;
  transform: translateX(-50%);
  padding: 0.22rem 0.5rem;
  background: rgba(2, 14, 17, 0.88);
  font-size: 0.76em;
  text-align: center;
  white-space: nowrap;
}

.surface-play-hud__target {
  inset-block-start: calc(50% + 1.4rem);
  color: var(--surface-play-cyan);
}

.surface-play-hud__transient-action-zone,
.surface-play-hud__warning-zone {
  position: absolute;
  inset-inline: 24%;
  display: grid;
  justify-items: center;
  pointer-events: none;
}

.surface-play-hud__transient-action-zone {
  inset-block-start: 8%;
}

.surface-play-hud__warning-zone {
  inset-block-end: 10%;
}

.surface-play-hud__action,
.surface-play-hud__block {
  display: block;
  max-inline-size: min(36rem, 100%);
  padding: 0.3rem 0.65rem;
  background: rgba(2, 14, 17, 0.88);
  font-size: 0.78em;
  text-align: center;
  white-space: normal;
}

.surface-play-hud__action {
  color: #d8f6f5;
}

.surface-play-hud__block {
  color: var(--surface-play-amber);
  border-inline-start: 2px solid var(--surface-play-amber);
}

.surface-play-ui__pointer-lock {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.55rem;
  pointer-events: none;
}

.surface-play-ui__pointer-lock[hidden] {
  display: none;
}

.surface-play-ui__pointer-status {
  margin: 0;
  padding: 0.35rem 0.8rem;
  color: var(--surface-play-amber);
  background: var(--surface-play-graphite);
  border-inline-start: 2px solid var(--surface-play-amber);
  font-size: 0.78em;
  letter-spacing: 0.12em;
}

.surface-play-ui__pointer-button {
  min-block-size: 2.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid var(--surface-play-cyan);
  color: #e6ffff;
  background: #071c20;
  font: inherit;
  letter-spacing: 0.1em;
  cursor: pointer;
  pointer-events: auto;
  clip-path: polygon(0 0, calc(100% - 0.55rem) 0, 100% 0.55rem, 100% 100%, 0.55rem 100%, 0 calc(100% - 0.55rem));
}

.surface-play-ui__pointer-button:hover {
  border-color: #d8ffff;
  color: #ffffff;
}

.surface-play-ui__pointer-button:focus-visible {
  outline: 3px solid var(--surface-play-amber);
  outline-offset: 0.25rem;
}

.surface-play-debug-overlay {
  position: absolute;
  inset-block-start: 0.75rem;
  inset-inline-end: 0.75rem;
  z-index: 24;
  display: grid;
  gap: 0.22rem;
  inline-size: min(34rem, calc(100vw - 1.5rem));
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(141, 235, 240, 0.68);
  background: rgba(3, 12, 13, 0.94);
  box-shadow: 0 0.3rem 1rem rgba(0, 0, 0, 0.42);
  color: #d8f6f5;
  font: 500 clamp(0.66rem, 0.78vw, 0.78rem)/1.35 "IBM Plex Mono", "Cascadia Mono", Consolas, monospace;
  letter-spacing: 0.025em;
  pointer-events: none;
}

.surface-play-debug-overlay__heading,
.surface-play-debug-overlay__metric {
  margin: 0;
}

.surface-play-debug-overlay__heading {
  color: var(--surface-play-cyan, #8debf0);
  font-size: 1em;
  letter-spacing: 0.1em;
}

.surface-play-debug-overlay__graph {
  display: block;
  inline-size: 100%;
  block-size: 4.5rem;
  border-block: 1px solid rgba(141, 235, 240, 0.2);
  background: rgba(0, 0, 0, 0.26);
}

.surface-play-debug-overlay__graph-line {
  stroke: #8debf0;
  stroke-width: 1.4;
  vector-effect: non-scaling-stroke;
}

[hidden] {
  display: none !important;
}

@media (max-width: 80rem) and (max-height: 45rem) {
  .surface-play-hud__panel {
    inline-size: min(18rem, 30vw);
    padding: 0.55rem 0.75rem 0.65rem;
  }

  .surface-play-hud__location {
    inset-block-start: 0.75rem;
    inset-inline-start: 0.75rem;
  }

  .surface-play-hud__suit {
    inset-block-end: 0.75rem;
    inset-inline-start: 0.75rem;
  }

  .surface-play-hud__weapon {
    inset-block-end: 0.75rem;
    inset-inline-end: 0.75rem;
  }

  .surface-play-hud__center-safe {
    inset: 22% 30%;
  }

  .surface-play-hud__transient-action-zone,
  .surface-play-hud__warning-zone {
    inset-inline: 31%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .surface-play-ui *,
  .surface-play-ui *::before,
  .surface-play-ui *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
`;
