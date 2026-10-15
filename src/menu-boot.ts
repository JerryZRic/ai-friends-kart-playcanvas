import {failBrandIntro} from './brand-intro';
export interface MenuBootController {
  begin(fallback?: () => void): void;
  stage(step: number, text: string): void;
  ready(): boolean;
  dismiss(): void;
  fail(message: string): void;
  dispose(): void;
}

const mountedBoots = new WeakMap<Document, MenuBootController>();

/** The lightweight recovery UI can be mounted again after every SPA route hop. */
export function mountMenuBoot(document: Document): MenuBootController {
  mountedBoots.get(document)?.dispose();
  const window = document.defaultView;
  const panel = document.getElementById('menu-boot');
  const status = document.getElementById('menu-boot-status');
  const bar = document.getElementById('menu-boot-progress') as HTMLProgressElement | null;
  const detail = document.getElementById('menu-boot-detail');
  const retry = document.getElementById('menu-boot-retry') as HTMLButtonElement | null;
  const proceed = document.getElementById('menu-boot-continue') as HTMLButtonElement | null;
  if (!window || !panel || !status || !bar || !detail || !retry || !proceed) {
    throw new Error('The menu loading shell must be present before mountMenuBoot()');
  }
  let timer: number | undefined, failed = false, finished = false, disposed = false;
  let fallback: (() => void) | undefined;
  function clearTimer() { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; }
  function fail(message: string) {
    if (disposed || finished || failed) return;
    failed = true; clearTimer();
    panel.setAttribute('aria-busy', 'false'); status.textContent = message;
    detail.textContent = '请检查网络后重试；若当前设备无法显示 3D，可使用静态背景进入菜单';
    bar.hidden = true; retry.hidden = false; proceed.hidden = !fallback;
    failBrandIntro(document);
  }
  function begin(next?: () => void) {
    if (disposed) return;
    clearTimer(); fallback = next; failed = false; finished = false;
    panel.hidden = false; panel.setAttribute('aria-busy', 'true');
    bar.hidden = false; bar.value = 0; retry.hidden = true; retry.disabled = false; proceed.hidden = true;
    document.body.dataset.menuLoading = 'true'; status.textContent = '正在载入菜单程序…';
    detail.textContent = '准备阶段 1 / 4 · 首次打开可能需要稍候';
    timer = window.setTimeout(() => fail('加载时间较长，暂时无法完成首页准备'), 30000);
  }
  function ready() {
    if (disposed || failed) return false;
    finished = true; clearTimer(); bar.value = 4;
    panel.hidden = true; panel.setAttribute('aria-busy', 'false');
    document.body.dataset.menuLoading = 'false';
    return true;
  }
  function stage(step: number, text: string) {
    if (disposed || failed || finished) return;
    bar.value = step - 1; status.textContent = text;
    detail.textContent = `准备阶段 ${step} / 4 · 按实际初始化步骤推进`;
  }
  function dismiss() { if (disposed) return; failed = false; fallback = undefined; ready(); }
  function retryLoading() { if (disposed) return; retry.disabled = true; window.location.reload(); }
  function continueWithFallback() {
    if (disposed || !fallback || finished) return;
    const action = fallback; fallback = undefined; failed = false;
    if (ready()) action();
  }
  function scriptError(event: Event) {
    if ((event.target as Element | null)?.tagName === 'SCRIPT') fail('菜单程序加载失败，请重新加载');
  }
  function rejected() { fail('首页初始化未完成，请重新加载'); }
  function dispose() {
    if (disposed) return;
    dismiss(); disposed = true; clearTimer(); fallback = undefined;
    retry.removeEventListener('click', retryLoading); proceed.removeEventListener('click', continueWithFallback);
    window.removeEventListener('error', scriptError, true); window.removeEventListener('unhandledrejection', rejected);
    if (mountedBoots.get(document) === controller) mountedBoots.delete(document);
  }
  const controller = {begin, stage, ready, dismiss, fail, dispose};
  retry.addEventListener('click', retryLoading); proceed.addEventListener('click', continueWithFallback);
  window.addEventListener('error', scriptError, true); window.addEventListener('unhandledrejection', rejected);
  mountedBoots.set(document, controller);
  begin();
  return controller;
}
