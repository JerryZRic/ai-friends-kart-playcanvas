/** One logical composition, uniformly scaled to fit the available viewport.
 * The accessible HTML overlay is intentionally independent of PlayCanvas pixels.
 */
export const GARAGE_DESIGN_WIDTH = 1440;
export const GARAGE_DESIGN_HEIGHT = 900;
export const GARAGE_DIALOG_WIDTH = 820;
export const GARAGE_DIALOG_HEIGHT = 720;

export interface GarageLayout {
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

function finiteSize(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Offsets account for a panned visual viewport, including the mobile keyboard. */
export function garageLayout(viewportWidth: number, viewportHeight: number, offsetLeft = 0, offsetTop = 0): GarageLayout {
  const vw = finiteSize(viewportWidth, GARAGE_DESIGN_WIDTH), vh = finiteSize(viewportHeight, GARAGE_DESIGN_HEIGHT);
  const x = Number.isFinite(offsetLeft) ? offsetLeft : 0, y = Number.isFinite(offsetTop) ? offsetTop : 0;
  const scale = Math.min(vw / GARAGE_DESIGN_WIDTH, vh / GARAGE_DESIGN_HEIGHT);
  const width = GARAGE_DESIGN_WIDTH * scale, height = GARAGE_DESIGN_HEIGHT * scale;
  return {viewportWidth: vw, viewportHeight: vh, scale, left: x + (vw - width) / 2, top: y + (vh - height) / 2, width, height, centerX: x + vw / 2, centerY: y + vh / 2};
}

/** Dialogs occupy the native top layer, so they need the same scale explicitly. */
export function garageDialogBounds(layout: GarageLayout) {
  const width = GARAGE_DIALOG_WIDTH * layout.scale, height = GARAGE_DIALOG_HEIGHT * layout.scale;
  return {left: layout.centerX - width / 2, top: layout.centerY - height / 2, width, height, scale: layout.scale};
}

const mountedLayouts = new WeakMap<HTMLElement, () => void>();
const layoutProperties = ['--garage-ui-scale', '--garage-ui-left', '--garage-ui-top', '--garage-ui-center-x', '--garage-ui-center-y', '--garage-design-width', '--garage-design-height'] as const;

/** Mount after creating the garage controls and before creating its preview.
 * onChange runs synchronously after CSS variables are applied. The preview can
 * resize its physical render target here; CSS transforms do not notify a
 * ResizeObserver of a change to the element's logical content-box dimensions.
 */
export function mountGarageLayout(root: HTMLElement, onChange?: (layout: GarageLayout) => void, host: Window = window) {
  mountedLayouts.get(root)?.();
  const originalAttribute = root.getAttribute('data-fixed-layout');
  const originals = layoutProperties.map(name => ({name, value: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name)}));
  let disposed = false, frame = 0, current: GarageLayout;
  const visualViewport = host.visualViewport;

  function update(): GarageLayout {
    if (disposed) return current;
    const viewport = host.visualViewport;
    const next = garageLayout(finiteSize(viewport?.width ?? 0, host.innerWidth), finiteSize(viewport?.height ?? 0, host.innerHeight), viewport?.offsetLeft, viewport?.offsetTop);
    if (current && Object.keys(next).every(key => next[key as keyof GarageLayout] === current[key as keyof GarageLayout])) return current;
    current = next;
    root.setAttribute('data-fixed-layout', `${GARAGE_DESIGN_WIDTH}x${GARAGE_DESIGN_HEIGHT}`);
    const values = [String(next.scale), `${next.left}px`, `${next.top}px`, `${next.centerX}px`, `${next.centerY}px`, `${GARAGE_DESIGN_WIDTH}px`, `${GARAGE_DESIGN_HEIGHT}px`];
    layoutProperties.forEach((name, index) => root.style.setProperty(name, values[index]));
    onChange?.(next);
    return next;
  }

  function schedule() {
    if (disposed || frame) return;
    frame = host.requestAnimationFrame(() => {frame = 0; update();});
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame) host.cancelAnimationFrame(frame);
    frame = 0;
    host.removeEventListener('resize', schedule);
    host.removeEventListener('orientationchange', schedule);
    visualViewport?.removeEventListener('resize', schedule);
    visualViewport?.removeEventListener('scroll', schedule);
    for (const {name, value, priority} of originals) {
      if (value) root.style.setProperty(name, value, priority);
      else root.style.removeProperty(name);
    }
    if (originalAttribute === null) root.removeAttribute('data-fixed-layout');
    else root.setAttribute('data-fixed-layout', originalAttribute);
    if (mountedLayouts.get(root) === dispose) mountedLayouts.delete(root);
  }

  host.addEventListener('resize', schedule);
  host.addEventListener('orientationchange', schedule);
  visualViewport?.addEventListener('resize', schedule);
  visualViewport?.addEventListener('scroll', schedule);
  mountedLayouts.set(root, dispose);
  update();
  return {update, dispose, get layout() {return current;}};
}
