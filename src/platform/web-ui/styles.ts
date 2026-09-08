/**
 * Web Adapter V1 interaction CSS.
 *
 * Mechanics are adapted from Base UI and shadcn composition patterns. Visual
 * identity comes exclusively from Modula runtime variables supplied by the
 * semantic adapters.
 */
export const MODULA_WEB_UI_CSS = String.raw`
@supports (-webkit-touch-callout: none) {
  body { position: relative; }
}

.modula-web-ui,
.modula-web-ui * {
  box-sizing: border-box;
}

.modula-web-ui {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.modula-web-visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.modula-web-backdrop {
  position: fixed;
  inset: 0;
  z-index: 24;
  background: var(--modula-web-overlay);
  opacity: 1;
  transition: opacity var(--modula-web-motion-overlay) ease-out;
  -webkit-tap-highlight-color: transparent;
}

.modula-web-backdrop[data-starting-style],
.modula-web-backdrop[data-ending-style] {
  opacity: 0;
}

@supports (-webkit-touch-callout: none) {
  .modula-web-drawer-backdrop {
    position: absolute;
    min-block-size: 100dvh;
  }
}

.modula-web-drawer-viewport,
.modula-web-dialog-viewport {
  position: fixed;
  inset: 0;
  z-index: 25;
  display: flex;
  pointer-events: none;
  overscroll-behavior: contain;
}

.modula-web-drawer-viewport[data-direction='bottom'] {
  align-items: flex-end;
  justify-content: center;
}

.modula-web-drawer-viewport[data-direction='left'] {
  align-items: stretch;
  justify-content: flex-start;
}

.modula-web-drawer-viewport[data-direction='right'] {
  align-items: stretch;
  justify-content: flex-end;
}

.modula-web-drawer-popup,
.modula-web-dialog-popup {
  pointer-events: auto;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  color: var(--modula-web-text);
  background: var(--modula-web-surface);
  border: 1px solid var(--modula-web-border);
  outline: 0;
  box-shadow: 0 18px 50px rgb(0 0 0 / 18%);
  transition:
    transform var(--modula-web-motion-overlay) cubic-bezier(.22, 1, .36, 1),
    scale var(--modula-web-motion-fast) ease-out,
    filter var(--modula-web-motion-fast) ease-out,
    opacity var(--modula-web-motion-fast) ease-out;
}

.modula-web-drawer-popup[data-direction='bottom'] {
  width: min(100%, 46rem);
  max-height: calc(100dvh - max(1rem, env(safe-area-inset-top)));
  border-radius: var(--modula-web-radius-lg) var(--modula-web-radius-lg) 0 0;
  border-bottom: 0;
  transform: translateY(calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y, 0px)));
}

.modula-web-drawer-popup[data-direction='bottom'][data-starting-style],
.modula-web-drawer-popup[data-direction='bottom'][data-ending-style] {
  transform: translateY(100%);
}

.modula-web-drawer-popup[data-direction='left'],
.modula-web-drawer-popup[data-direction='right'] {
  width: min(90vw, 28rem);
  max-block-size: 100dvh;
}

.modula-web-drawer-popup[data-direction='left'] {
  border-radius: 0 var(--modula-web-radius-lg) var(--modula-web-radius-lg) 0;
  transform: translateX(var(--drawer-swipe-movement-x, 0px));
}

.modula-web-drawer-popup[data-direction='right'] {
  border-radius: var(--modula-web-radius-lg) 0 0 var(--modula-web-radius-lg);
  transform: translateX(var(--drawer-swipe-movement-x, 0px));
}

.modula-web-drawer-popup[data-direction='left'][data-starting-style],
.modula-web-drawer-popup[data-direction='left'][data-ending-style] {
  transform: translateX(-100%);
}

.modula-web-drawer-popup[data-direction='right'][data-starting-style],
.modula-web-drawer-popup[data-direction='right'][data-ending-style] {
  transform: translateX(100%);
}

.modula-web-drawer-popup[data-swiping] {
  transition-duration: 0s;
  user-select: none;
}

.modula-web-drawer-popup[data-nested-drawer-open] {
  filter: saturate(.82) brightness(.9);
  opacity: .72;
  scale: .985;
}

.modula-web-drawer-handle-target {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  touch-action: none;
}

.modula-web-drawer-handle {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--modula-web-separator);
}

.modula-web-drawer-popup[data-nested-drawer-open] > .modula-web-drawer-handle-target {
  opacity: 0;
  visibility: hidden;
}

.modula-web-overlay-content {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.modula-web-overlay-header {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--modula-web-space-1);
  padding: var(--modula-web-space-2) var(--modula-web-space-4) var(--modula-web-space-3);
}

.modula-web-overlay-title {
  margin: 0;
  font: inherit;
  font-size: 1.05rem;
  line-height: 1.25;
  font-weight: 700;
  color: var(--modula-web-text);
}

.modula-web-overlay-description {
  margin: 0;
  font: inherit;
  font-size: .875rem;
  line-height: 1.4;
  color: var(--modula-web-text-secondary);
}

.modula-web-overlay-custom-header {
  padding: var(--modula-web-space-3) var(--modula-web-space-4) 0;
}

.modula-web-drawer-navigation-header {
  display: grid;
  min-height: 44px;
  grid-template-columns: minmax(0, 1fr) minmax(7rem, 1.15fr) minmax(44px, 1fr);
  align-items: center;
  column-gap: var(--modula-web-space-2);
}

.modula-web-drawer-navigation-back {
  display: inline-flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  gap: 4px;
  justify-self: start;
  padding: 0 var(--modula-web-space-2) 0 0;
  border: 0;
  outline: 0;
  color: var(--modula-web-text);
  background: transparent;
  font: inherit;
  font-size: .875rem;
  font-weight: 650;
  cursor: pointer;
}
.modula-web-drawer-navigation-back > :last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modula-web-drawer-navigation-back:focus-visible,
.modula-web-drawer-navigation-heading > h2:focus-visible { outline: 2px solid var(--modula-web-focus); outline-offset: 2px; }
.modula-web-drawer-navigation-header-spacer { min-width: 44px; min-height: 44px; }
.modula-web-drawer-navigation-heading { min-width: 0; text-align: center; }
.modula-web-drawer-navigation-heading > h2 {
  margin: 0;
  border-radius: 4px;
  outline: 0;
  font: inherit;
  font-size: 1.05rem;
  line-height: 1.25;
  font-weight: 720;
  overflow-wrap: anywhere;
}
.modula-web-drawer-navigation-heading > p {
  margin: 2px 0 0;
  color: var(--modula-web-text-secondary);
  font: inherit;
  font-size: .78rem;
  line-height: 1.3;
}
.modula-web-drawer-navigation-trailing {
  display: flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: flex-end;
}

.modula-web-drawer-navigation {
  position: relative;
  height: var(--modula-drawer-page-height, auto);
  min-height: 1px;
  transition: height var(--modula-drawer-height-duration, var(--modula-web-motion-fast)) cubic-bezier(.22, 1, .36, 1);
}
.modula-web-drawer-navigation-page[data-active='true'] {
  width: 100%;
  animation: modula-drawer-page-forward var(--modula-drawer-page-duration, var(--modula-web-motion-fast)) cubic-bezier(.22, 1, .36, 1);
}
.modula-web-drawer-navigation[data-direction='back'] > .modula-web-drawer-navigation-page[data-active='true'] {
  animation-name: modula-drawer-page-back;
}
.modula-web-drawer-navigation[data-direction='replace'] > .modula-web-drawer-navigation-page[data-active='true'] {
  animation-name: modula-drawer-page-replace;
}

@keyframes modula-drawer-page-forward {
  from { opacity: 0; transform: translateX(var(--modula-drawer-page-translate, 10px)); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes modula-drawer-page-back {
  from { opacity: 0; transform: translateX(calc(-1 * var(--modula-drawer-page-translate, 10px))); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes modula-drawer-page-replace {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modula-web-overlay-body {
  min-height: 0;
  padding: 0 var(--modula-web-space-4) var(--modula-web-space-4);
  overscroll-behavior: contain;
}

.modula-web-overlay-body[data-scroll='true'] {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.modula-web-overlay-footer {
  flex: 0 0 auto;
  padding: var(--modula-web-space-3) var(--modula-web-space-4)
    max(var(--modula-web-space-4), env(safe-area-inset-bottom));
  border-top: 1px solid var(--modula-web-separator);
  background: var(--modula-web-surface);
}

.modula-web-dialog-viewport {
  z-index: 33;
  align-items: center;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
}

.modula-web-dialog-viewport .modula-web-backdrop {
  z-index: -1;
}

.modula-web-dialog-popup {
  width: min(100%, 34rem);
  max-height: min(86dvh, 54rem);
  border-radius: var(--modula-web-radius-lg);
  opacity: 1;
  transform: translateY(0) scale(1);
}

.modula-web-dialog-popup[data-size='small'] { width: min(100%, 26rem); }
.modula-web-dialog-popup[data-size='large'] { width: min(100%, 46rem); }

.modula-web-dialog-popup[data-starting-style],
.modula-web-dialog-popup[data-ending-style] {
  opacity: 0;
  transform: translateY(8px) scale(.985);
}

.modula-web-edge-sheet {
  position: absolute;
  inset-block: 0;
  right: 0;
  width: min(92vw, 32rem);
  max-block-size: 100dvh;
  border-radius: var(--modula-web-radius-lg) 0 0 var(--modula-web-radius-lg);
  transform: translateX(0);
}

.modula-web-edge-sheet[data-side='left'] {
  right: auto;
  left: 0;
  border-radius: 0 var(--modula-web-radius-lg) var(--modula-web-radius-lg) 0;
}

.modula-web-edge-sheet[data-side='bottom'] {
  inset-block: auto 0;
  inset-inline: 0;
  width: 100%;
  max-height: min(78dvh, 42rem);
  border-radius: var(--modula-web-radius-lg) var(--modula-web-radius-lg) 0 0;
  transform: translateY(0);
}

.modula-web-edge-sheet[data-starting-style],
.modula-web-edge-sheet[data-ending-style] {
  transform: translateX(100%);
}

.modula-web-edge-sheet[data-side='left'][data-starting-style],
.modula-web-edge-sheet[data-side='left'][data-ending-style] {
  transform: translateX(-100%);
}

.modula-web-edge-sheet[data-side='bottom'][data-starting-style],
.modula-web-edge-sheet[data-side='bottom'][data-ending-style] {
  transform: translateY(100%);
}

.modula-web-menu-trigger,
.modula-web-popover-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.modula-web-menu-trigger:focus-visible,
.modula-web-popover-trigger:focus-visible,
.modula-web-menu-item:focus-visible,
.modula-web-button:focus-visible,
.modula-web-icon-button:focus-visible,
.modula-web-input:focus-visible,
.modula-web-horizontal-scroll:focus-visible {
  outline: 2px solid var(--modula-web-focus);
  outline-offset: 2px;
}

.modula-web-menu-positioner,
.modula-web-popover-positioner {
  z-index: 35;
  outline: 0;
}

.modula-web-menu-popup,
.modula-web-popover-popup {
  min-width: 13rem;
  max-width: min(22rem, calc(100vw - 1rem));
  max-height: min(28rem, calc(100dvh - 1rem));
  overflow: auto;
  padding: var(--modula-web-space-1);
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  outline: 0;
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  box-shadow: 0 12px 34px rgb(0 0 0 / 16%);
  transform-origin: var(--transform-origin);
  transition: transform var(--modula-web-motion-fast) ease-out, opacity var(--modula-web-motion-fast) ease-out;
}

.modula-web-touch-actions,
.modula-web-touch-action-group {
  display: flex;
  flex-direction: column;
  gap: var(--modula-web-space-1);
}

.modula-web-popover-popup {
  width: min(22rem, calc(100vw - 1rem));
  padding: var(--modula-web-space-3);
}

.modula-web-menu-popup[data-starting-style],
.modula-web-menu-popup[data-ending-style],
.modula-web-popover-popup[data-starting-style],
.modula-web-popover-popup[data-ending-style] {
  opacity: 0;
  transform: scale(.98);
}

.modula-web-menu-item {
  width: 100%;
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--modula-web-space-2);
  min-height: 36px;
  padding: var(--modula-web-space-2) var(--modula-web-space-3);
  border: 0;
  border-radius: calc(var(--modula-web-radius-md) * .72);
  outline: 0;
  color: var(--modula-web-text);
  background: transparent;
  appearance: none;
  font: inherit;
  font-size: .875rem;
  line-height: 1.25;
  cursor: default;
  text-align: left;
  user-select: none;
}

.modula-web-menu-item[data-highlighted] {
  color: var(--modula-web-accent-foreground);
  background: var(--modula-web-accent);
}

.modula-web-menu-item[data-disabled] {
  opacity: .48;
}

.modula-web-menu-item[data-destructive='true'] {
  color: var(--modula-web-destructive);
}

.modula-web-menu-separator {
  height: 1px;
  margin: var(--modula-web-space-1);
  background: var(--modula-web-separator);
}

.modula-web-menu-group-label {
  padding: var(--modula-web-space-2) var(--modula-web-space-3) var(--modula-web-space-1);
  color: var(--modula-web-text-tertiary);
  font-size: .72rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.modula-web-context-trigger {
  display: inline-flex;
  min-width: 0;
  outline: 0;
}

.modula-web-context-trigger-fill {
  display: flex;
  width: 100%;
}

.modula-web-menu-indicator { grid-column: 1; }
.modula-web-menu-label { grid-column: 2; }
.modula-web-menu-trailing { grid-column: 3; color: var(--modula-web-text-tertiary); }

.modula-web-button,
.modula-web-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.modula-web-button-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 var(--modula-web-space-3);
  border: 1px solid transparent;
  border-radius: var(--modula-web-radius-md);
  font-size: .875rem;
  line-height: 1;
  font-weight: 650;
  transition: background var(--modula-web-motion-fast), border-color var(--modula-web-motion-fast), transform 80ms ease-out;
}

.modula-web-button[data-size='regular'] .modula-web-button-visual { min-height: 36px; padding-inline: var(--modula-web-space-4); }
.modula-web-button[data-size='prominent'] .modula-web-button-visual { min-height: 42px; padding-inline: var(--modula-web-space-4); }
.modula-web-button[data-role='primary'] .modula-web-button-visual { background: var(--modula-web-accent); color: var(--modula-web-accent-foreground); }
.modula-web-button[data-role='secondary'] .modula-web-button-visual,
.modula-web-button[data-role='glass'] .modula-web-button-visual { background: var(--modula-web-surface-raised); border-color: var(--modula-web-border); }
.modula-web-button[data-role='destructive'] .modula-web-button-visual { background: var(--modula-web-destructive); color: var(--modula-web-accent-foreground); }
.modula-web-button[data-role='quiet'] .modula-web-button-visual,
.modula-web-button[data-role='plain'] .modula-web-button-visual,
.modula-web-button[data-role='inline'] .modula-web-button-visual { color: var(--modula-web-accent); }

@media (hover: hover) {
  .modula-web-button:not(:disabled):hover .modula-web-button-visual,
  .modula-web-icon-button:not(:disabled):hover .modula-web-icon-button-visual {
    filter: brightness(.96);
    background-color: color-mix(in srgb, var(--modula-web-accent) 12%, var(--modula-web-surface-raised));
  }
}

.modula-web-button:not(:disabled):active .modula-web-button-visual,
.modula-web-icon-button:not(:disabled):active .modula-web-icon-button-visual { transform: scale(.97); }
.modula-web-button:disabled,
.modula-web-icon-button:disabled { cursor: default; opacity: .46; }
.modula-web-button[data-full-width='true'] { width: 100%; }
.modula-web-button[data-full-width='true'] .modula-web-button-visual { width: 100%; }

.modula-web-icon-button-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 999px;
  transition: background var(--modula-web-motion-fast), transform 80ms ease-out;
}

.modula-web-icon-button[data-chrome='bordered'] .modula-web-icon-button-visual,
.modula-web-icon-button[data-chrome='glass'] .modula-web-icon-button-visual {
  width: 38px;
  height: 38px;
  border-color: var(--modula-web-border);
  background: var(--modula-web-surface-raised);
}

.modula-web-icon-button[data-chrome='glass'] .modula-web-icon-button-visual {
  width: 44px;
  height: 44px;
  background: color-mix(in srgb, var(--modula-web-surface-raised) 76%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(145%);
  backdrop-filter: blur(22px) saturate(145%);
}

.modula-web-icon-button[data-chrome='glass'][data-reduce-transparency='true'] .modula-web-icon-button-visual {
  background: var(--modula-web-surface-raised);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.modula-web-input {
  width: 100%;
  min-height: 42px;
  margin: 0;
  padding: var(--modula-web-space-2) var(--modula-web-space-4);
  resize: vertical;
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  outline: 0;
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  font: inherit;
  line-height: 1.45;
}

.modula-web-input::placeholder { color: var(--modula-web-text-tertiary); }
.modula-web-input[data-plain='true'] { padding-inline: 0; border-color: transparent; background: transparent; }
.modula-web-input[aria-invalid='true'] { border-color: var(--modula-web-destructive); }

.modula-web-input-error {
  display: block;
  padding-top: var(--modula-web-space-1);
  color: var(--modula-web-destructive);
  font-size: .8rem;
  line-height: 1.35;
}

.modula-web-select-trigger {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: var(--modula-web-space-3);
  padding: 0 var(--modula-web-space-4);
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  outline: 0;
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  font: inherit;
  cursor: pointer;
}

.modula-web-select-trigger:focus-visible,
.modula-web-combobox-group:focus-within {
  outline: 2px solid var(--modula-web-focus);
  outline-offset: 2px;
}

.modula-web-select-list { max-height: min(22rem, var(--available-height)); overflow: auto; outline: 0; }
.modula-web-select-empty { padding: var(--modula-web-space-3); color: var(--modula-web-text-secondary); font-size: .875rem; }
.modula-web-combobox-label { display: block; margin-bottom: var(--modula-web-space-1); color: var(--modula-web-text); font-size: .875rem; font-weight: 650; }
.modula-web-combobox-group { position: relative; display: flex; width: 100%; border-radius: var(--modula-web-radius-md); }
.modula-web-combobox-group .modula-web-input { padding-right: 4.5rem; }
.modula-web-combobox-actions { position: absolute; inset-block: 0; right: 0; display: flex; align-items: center; }
.modula-web-combobox-action { width: 2rem; block-size: 100%; padding: 0; border: 0; color: var(--modula-web-text-secondary); background: transparent; font: inherit; cursor: pointer; }
.modula-web-combobox-popup { width: var(--anchor-width); }
.modula-web-picker-search { padding-bottom: var(--modula-web-space-3); }

.modula-web-toggle-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  background: var(--modula-web-surface-muted);
}
.modula-web-toggle-item {
  min-width: 36px;
  min-height: 34px;
  padding: 0 var(--modula-web-space-3);
  border: 0;
  border-radius: calc(var(--modula-web-radius-md) * .75);
  outline: 0;
  color: var(--modula-web-text-secondary);
  background: transparent;
  font: inherit;
  font-size: .84rem;
  font-weight: 650;
  cursor: pointer;
}
.modula-web-toggle-item[aria-pressed='true'] { color: var(--modula-web-text); background: var(--modula-web-surface-raised); box-shadow: inset 0 0 0 1px var(--modula-web-border); }
.modula-web-toggle-item:focus-visible { outline: 2px solid var(--modula-web-focus); outline-offset: 1px; }
.modula-web-toggle-item:disabled { opacity: .45; cursor: default; }

.modula-web-tooltip-positioner { z-index: 50; }
.modula-web-tooltip {
  max-width: 18rem;
  padding: 5px 8px;
  border: 1px solid var(--modula-web-border);
  border-radius: calc(var(--modula-web-radius-md) * .65);
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  box-shadow: 0 6px 18px rgb(0 0 0 / 14%);
  font-size: .75rem;
  line-height: 1.3;
  transition: opacity var(--modula-web-motion-fast), transform var(--modula-web-motion-fast);
}
.modula-web-tooltip[data-starting-style],
.modula-web-tooltip[data-ending-style] { opacity: 0; transform: scale(.97); }

.modula-web-tabs { width: 100%; min-width: 0; }
.modula-web-tabs-list {
  position: relative;
  display: flex;
  min-width: 0;
  gap: var(--modula-web-space-1);
  overflow-x: auto;
  scrollbar-width: none;
}
.modula-web-tabs-list::-webkit-scrollbar { display: none; }
.modula-web-tabs-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  min-height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 var(--modula-web-space-3);
  border: 0;
  border-radius: var(--modula-web-radius-md);
  outline: 0;
  color: var(--modula-web-text-secondary);
  background: transparent;
  font: inherit;
  font-size: .875rem;
  font-weight: 620;
  cursor: pointer;
}
.modula-web-tabs-tab[data-active] {
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  box-shadow: inset 0 0 0 1px var(--modula-web-border);
}
.modula-web-tabs-tab:focus-visible { outline: 2px solid var(--modula-web-focus); outline-offset: -2px; }
.modula-web-tabs-tab[data-disabled] { opacity: .45; cursor: default; }
.modula-web-tabs-indicator {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: var(--active-tab-width);
  translate: var(--active-tab-left);
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  background: var(--modula-web-surface-raised);
  transition: translate var(--modula-web-motion-fast), width var(--modula-web-motion-fast);
}
.modula-web-tabs[data-presentation='underline'] .modula-web-tabs-indicator,
.modula-web-tabs[data-presentation='navigation'] .modula-web-tabs-indicator {
  inset-block: auto 0;
  height: 2px;
  border: 0;
  border-radius: 2px;
  background: var(--modula-web-accent);
}
.modula-web-tabs[data-presentation='underline'] .modula-web-tabs-tab[data-active],
.modula-web-tabs[data-presentation='navigation'] .modula-web-tabs-tab[data-active] {
  border-radius: 0;
  background: transparent;
  box-shadow: inset 0 -2px 0 var(--modula-web-accent);
}

.modula-web-command { padding: var(--modula-web-space-4); gap: var(--modula-web-space-3); }
.modula-web-command-input {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--modula-web-space-3);
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  outline: 0;
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  font: inherit;
}
.modula-web-command-input:focus-visible { outline: 2px solid var(--modula-web-focus); outline-offset: 2px; }
.modula-web-command-results { display: flex; max-height: min(24rem, 60dvh); flex-direction: column; gap: var(--modula-web-space-1); overflow: auto; }
.modula-web-command-item {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: var(--modula-web-space-3);
  padding: var(--modula-web-space-2) var(--modula-web-space-3);
  border: 0;
  border-radius: var(--modula-web-radius-md);
  color: var(--modula-web-text);
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.modula-web-command-item[aria-selected='true'] { background: var(--modula-web-surface-raised); }
.modula-web-command-item:focus-visible { outline: 2px solid var(--modula-web-focus); outline-offset: -2px; }
.modula-web-command-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.modula-web-command-copy > :last-child:not(:first-child) { color: var(--modula-web-text-secondary); font-size: .8rem; }

.modula-web-toast-viewport {
  position: fixed;
  z-index: 40;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  width: min(22.5rem, calc(100vw - 2rem));
}
.modula-web-toast {
  --toast-gap: .75rem;
  --toast-scale: calc(max(0, 1 - (var(--toast-index) * .06)));
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  transform: translateX(var(--toast-swipe-movement-x)) translateY(calc(var(--toast-swipe-movement-y) - (var(--toast-index) * var(--toast-gap)))) scale(var(--toast-scale));
  transform-origin: bottom;
  border: 1px solid var(--modula-web-border);
  border-radius: var(--modula-web-radius-md);
  color: var(--modula-web-text);
  background: var(--modula-web-surface-raised);
  box-shadow: 0 12px 34px rgb(0 0 0 / 16%);
  transition: transform var(--modula-web-motion-overlay) cubic-bezier(.22, 1, .36, 1), opacity var(--modula-web-motion-fast);
}
.modula-web-toast[data-starting-style],
.modula-web-toast[data-ending-style] { opacity: 0; transform: translateY(120%); }
.modula-web-toast[data-limited] { opacity: 0; }
.modula-web-toast-content { display: flex; min-height: 52px; align-items: center; gap: var(--modula-web-space-3); padding: var(--modula-web-space-3); }
.modula-web-toast-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.modula-web-toast-title { font-size: .875rem; font-weight: 700; }
.modula-web-toast-description { color: var(--modula-web-text-secondary); font-size: .84rem; line-height: 1.35; }
.modula-web-toast-action,
.modula-web-toast-close { min-width: 32px; min-height: 32px; border: 0; color: var(--modula-web-accent); background: transparent; font: inherit; font-weight: 650; cursor: pointer; }
.modula-web-toast-action:focus-visible,
.modula-web-toast-close:focus-visible { outline: 2px solid var(--modula-web-focus); outline-offset: 2px; }

@media (max-width: 767px) {
  .modula-web-toast-viewport {
    right: 1rem;
    bottom: max(calc(4.5rem + env(safe-area-inset-bottom)), 5rem);
    left: 1rem;
    width: auto;
  }
}

.modula-web-horizontal-scroll {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  outline: 0;
  scrollbar-width: thin;
  scroll-snap-type: x proximity;
}

@media (prefers-reduced-motion: reduce) {
  .modula-web-backdrop,
  .modula-web-drawer-popup,
  .modula-web-dialog-popup,
  .modula-web-menu-popup,
  .modula-web-popover-popup,
  .modula-web-tooltip,
  .modula-web-button-visual,
  .modula-web-icon-button-visual {
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .modula-web-drawer-navigation { transition-duration: 1ms !important; }
  .modula-web-drawer-navigation-page[data-active='true'] { animation: none !important; }
}

.modula-web-drawer-navigation[data-reduce-motion='true'] { transition-duration: 1ms !important; }
.modula-web-drawer-navigation[data-reduce-motion='true'] > .modula-web-drawer-navigation-page[data-active='true'] { animation: none !important; }

[data-reduce-motion='true'].modula-web-backdrop,
[data-reduce-motion='true'] .modula-web-backdrop,
[data-reduce-motion='true'] .modula-web-drawer-popup,
[data-reduce-motion='true'] .modula-web-dialog-popup {
  transition-duration: 1ms !important;
}

@media (prefers-contrast: more) {
  .modula-web-drawer-popup,
  .modula-web-dialog-popup,
  .modula-web-menu-popup,
  .modula-web-popover-popup,
  .modula-web-input {
    border-width: 2px;
  }
}

/* DOM controls do not inherit React Native Text's platform font reset. */
.modula-web-ui {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.modula-web-button,
.modula-web-icon-button,
.modula-web-menu-trigger,
.modula-web-menu-item,
.modula-web-select-trigger,
.modula-web-input,
.modula-web-command-input,
.modula-web-command-item,
.modula-web-tabs-tab,
.modula-web-toggle-item,
.modula-web-tooltip,
.modula-web-drawer-navigation-back,
.modula-web-drawer-navigation-heading > h2,
.modula-web-drawer-navigation-heading > p {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`
