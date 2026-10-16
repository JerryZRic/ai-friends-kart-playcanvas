/** Stacking defaults on in browser releases, desktop file URLs and dev previews. */
export type ItemExperimentEnvironment = {development?: boolean; baseUrl?: string; pathname?: string};
export function itemStackingExperimentAvailable(environment: ItemExperimentEnvironment = {
  development: import.meta.env?.DEV,
  baseUrl: import.meta.env?.BASE_URL,
  pathname: globalThis.location?.pathname,
}): boolean {
  return environment.development === true || Boolean(environment.baseUrl) || typeof environment.pathname === 'string';
}

/** A checked control is only a pending choice; navigation starts a fresh race. */
export function itemStackingRestartUrl(href: string, enabled: boolean): string {
  const url = new URL(href);
  url.searchParams.set('itemStacking', enabled ? '1' : '0');
  url.searchParams.set('autostart', '1');
  return url.href;
}

export function mountItemExperimentSettings(document: Document, parent: HTMLElement | null, before: HTMLElement | null,
  navigate: (href: string) => void, environment?: ItemExperimentEnvironment): () => void {
  const location = document.defaultView?.location;
  const available = environment ? itemStackingExperimentAvailable(environment) : itemStackingExperimentAvailable({
    development: import.meta.env?.DEV, baseUrl: import.meta.env?.BASE_URL, pathname: location?.pathname,
  });
  if (!available || !parent || !location?.href || !document.createElement) return () => {};
  const panel = document.createElement('div');
  panel.className = 'pause-control-setting'; panel.dataset.itemExperimentSettings = 'true';
  const label = document.createElement('label');
  label.htmlFor = 'itemStackingExperiment';
  const checkbox = document.createElement('input');
  checkbox.id = 'itemStackingExperiment'; checkbox.type = 'checkbox';
  checkbox.checked = new URL(location.href).searchParams.get('itemStacking') !== '0';
  checkbox.setAttribute('aria-describedby', 'itemStackingExperimentHint');
  label.appendChild(checkbox); label.appendChild(document.createTextNode(' 三同类升级（下次比赛生效）'));
  const hint = document.createElement('small');
  hint.id = 'itemStackingExperimentHint';
  hint.textContent = '默认开启，可取消恢复普通双槽。同槽普通 ×2 每次用 1；第三枚变 super 1 次；super 后同类箱消耗但不强化、不填另一槽、不生成 Token。有空槽神秘箱照常抽取，满槽神秘箱不接收。E / R 共用 1.2 秒冷却。切换勾选不改变当前比赛，点击下方按钮会重新开始本场。';
  const apply = document.createElement('button');
  apply.type = 'button'; apply.textContent = '应用并重新开始';
  const restart = () => navigate(itemStackingRestartUrl(location.href, checkbox.checked));
  apply.addEventListener('click', restart);
  panel.appendChild(label); panel.appendChild(hint); panel.appendChild(apply);
  parent.insertBefore(panel, before);
  return () => {apply.removeEventListener('click', restart); panel.remove();};
}

