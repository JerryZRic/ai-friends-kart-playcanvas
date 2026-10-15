/** Experiments are opt-in and available only on the dev preview or Vite dev server. */
export type ItemExperimentEnvironment = {development?: boolean; baseUrl?: string; pathname?: string};
export function itemStackingExperimentAvailable(environment: ItemExperimentEnvironment = {
  development: import.meta.env?.DEV,
  baseUrl: import.meta.env?.BASE_URL,
  pathname: globalThis.location?.pathname,
}): boolean {
  const devPath = /(?:^|\/)dev(?:\/|$)/;
  return environment.development === true || devPath.test(environment.baseUrl ?? '') || devPath.test(environment.pathname ?? '');
}

/** A checked control is only a pending choice; navigation starts a fresh race. */
export function itemStackingRestartUrl(href: string, enabled: boolean): string {
  const url = new URL(href);
  if (enabled) url.searchParams.set('itemStacking', '1'); else url.searchParams.delete('itemStacking');
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
  checkbox.checked = new URL(location.href).searchParams.get('itemStacking') === '1';
  checkbox.setAttribute('aria-describedby', 'itemStackingExperimentHint');
  label.appendChild(checkbox); label.appendChild(document.createTextNode(' 实验：三同类升级（下次比赛生效）'));
  const hint = document.createElement('small');
  hint.id = 'itemStackingExperimentHint';
  hint.textContent = '默认关闭。同槽普通 ×2 每次用 1；第三枚变高阶 1 次；满槽神秘箱不接收。E / R 共用 1.2 秒冷却。勾选不改变当前比赛，点击下方按钮会重新开始本场。';
  const apply = document.createElement('button');
  apply.type = 'button'; apply.textContent = '应用并重新开始';
  const restart = () => navigate(itemStackingRestartUrl(location.href, checkbox.checked));
  apply.addEventListener('click', restart);
  panel.appendChild(label); panel.appendChild(hint); panel.appendChild(apply);
  parent.insertBefore(panel, before);
  return () => {apply.removeEventListener('click', restart); panel.remove();};
}
