interface DocumentIntro {
  isPending(): boolean;
  ready(): void;
  finish(): void;
  subscribe(callback: () => void): () => void;
}
type IntroWindow = Window & {__timewishIntro?: DocumentIntro};

export function brandIntroPending(document: Document): boolean {
  return (document.defaultView as IntroWindow | null)?.__timewishIntro?.isPending() ?? false;
}

/** Announce usable UI, after the scene's actual first settled frame. */
export function readyBrandIntro(document: Document) {
  (document.defaultView as IntroWindow | null)?.__timewishIntro?.ready();
}

/** Expose the existing retry/error UI immediately; never dismiss that UI. */
export function failBrandIntro(document: Document) {
  (document.defaultView as IntroWindow | null)?.__timewishIntro?.finish();
}

/** Subscribe to the early document clock; lazy modules and SPA hops never replay it. */
export function mountBrandIntro(document: Document, window: Window, onFinish: () => void) {
  const runtime = (window as IntroWindow).__timewishIntro;
  let finished = false;
  const finish = () => { if (!finished) { finished = true; onFinish(); } };
  const unsubscribe = runtime?.subscribe(finish);
  // Without the bootstrap, do not leave the scene permanently inert.
  if (!runtime) { document.getElementById('brand-intro')?.remove(); document.querySelector('[data-brand-intro-style]')?.remove(); finish(); }
  return {dispose() { unsubscribe?.(); runtime?.finish(); finish(); }};
}
