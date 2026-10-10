/** One logical composition, uniformly scaled to fit the available viewport.
 * The accessible HTML overlay is intentionally independent of PlayCanvas pixels.
 */
export const UI_DESIGN_WIDTH = 1440;
export const UI_DESIGN_HEIGHT = 900;

export interface UiLayout {
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
export function uiLayout(viewportWidth: number, viewportHeight: number, offsetLeft = 0, offsetTop = 0): UiLayout {
  const vw = finiteSize(viewportWidth, UI_DESIGN_WIDTH), vh = finiteSize(viewportHeight, UI_DESIGN_HEIGHT);
  const x = Number.isFinite(offsetLeft) ? offsetLeft : 0, y = Number.isFinite(offsetTop) ? offsetTop : 0;
  const scale = Math.min(vw / UI_DESIGN_WIDTH, vh / UI_DESIGN_HEIGHT);
  const width = UI_DESIGN_WIDTH * scale, height = UI_DESIGN_HEIGHT * scale;
  return {viewportWidth: vw, viewportHeight: vh, scale, left: x + (vw - width) / 2, top: y + (vh - height) / 2, width, height, centerX: x + vw / 2, centerY: y + vh / 2};
}

const mountedLayouts = new WeakMap<HTMLElement, () => void>();
const layoutProperties = ['--ui-scale', '--ui-left', '--ui-top', '--ui-center-x', '--ui-center-y', '--ui-design-width', '--ui-design-height'] as const;

/** Mount after creating the UI controls and before creating any preview.
 * onChange runs synchronously after CSS variables are applied. The preview can
 * resize its physical render target here; CSS transforms do not notify a
 * ResizeObserver of a change to the element's logical content-box dimensions.
 */
export function mountUiLayout(root: HTMLElement, onChange?: (layout: UiLayout) => void, host: Window = window, properties: readonly string[] = layoutProperties) {
  mountedLayouts.get(root)?.();
  const originalCompact = root.getAttribute('data-ui-compact');
  const originalAttribute = root.getAttribute('data-fixed-layout');
  const originals = properties.map(name => ({name, value: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name)}));
  let disposed = false, frame = 0, current: UiLayout;
  const visualViewport = host.visualViewport;

  function update(): UiLayout {
    if (disposed) return current;
    const viewport = host.visualViewport;
    const next = uiLayout(finiteSize(viewport?.width ?? 0, host.innerWidth), finiteSize(viewport?.height ?? 0, host.innerHeight), viewport?.offsetLeft, viewport?.offsetTop);
    if (current && Object.keys(next).every(key => next[key as keyof UiLayout] === current[key as keyof UiLayout])) return current;
    current = next;
    root.setAttribute('data-ui-compact', String(next.scale < .55));
    root.setAttribute('data-fixed-layout', `${UI_DESIGN_WIDTH}x${UI_DESIGN_HEIGHT}`);
    const values = [String(next.scale), `${next.left}px`, `${next.top}px`, `${next.centerX}px`, `${next.centerY}px`, `${UI_DESIGN_WIDTH}px`, `${UI_DESIGN_HEIGHT}px`];
    properties.forEach((name, index) => root.style.setProperty(name, values[index]));
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
    if (originalCompact === null) root.removeAttribute('data-ui-compact');
    else root.setAttribute('data-ui-compact', originalCompact);
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

/** A physical-size hint lives outside the transformed frame. It never replaces
 * or hides the HUD, so keyboard/touch controls remain available on small screens.
 */
export function mountUiViewportNotice(root: HTMLElement, host: Window = window) {
  const document = root.ownerDocument;
  if (!document?.createElement || !root.parentElement) return {dispose() {}};
  const notice = document.createElement('aside');
  notice.className = 'ui-viewport-notice';
  notice.setAttribute('role', 'status');
  notice.textContent = '横屏或放大窗口可获得更清晰的界面 · 游戏界面始终保持相同比例';
  root.parentElement.appendChild(notice);
  const viewport = host.visualViewport;
  function update() {
    const v = host.visualViewport;
    const layout = uiLayout(v?.width || host.innerWidth, v?.height || host.innerHeight, v?.offsetLeft, v?.offsetTop);
    // Keep this hint in unused top letterbox space; never cover race controls.
    notice.hidden = layout.scale >= .55 || layout.top - (v?.offsetTop || 0) < 60;
    notice.style.left = `${(v?.offsetLeft || 0) + 8}px`;
    notice.style.top = `${(v?.offsetTop || 0) + 8}px`;
    notice.style.width = `${Math.max(1, layout.viewportWidth - 16)}px`;
  }
  host.addEventListener('resize', update);
  host.addEventListener('orientationchange', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  update();
  let disposed = false;
  return {dispose() {
    if (disposed) return;
    disposed = true;
    host.removeEventListener('resize', update);
    host.removeEventListener('orientationchange', update);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    notice.remove();
  }};
}
