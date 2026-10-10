/** Display-only identity from the supplied character sheets. Machine IDs stay stable. */
export const CHARACTER_IDENTITIES = Object.freeze({
  whale: Object.freeze({label:'大肥鱼', emblem:'./character-emblems/whale.png'}),
  gemini: Object.freeze({label:'双子', emblem:'./character-emblems/gemini.png'}),
  gpt: Object.freeze({label:'小吉', emblem:'./character-emblems/gpt.png'}),
  claude: Object.freeze({label:'克洛德', emblem:'./character-emblems/claude.png'}),
  grok: Object.freeze({label:'洛可', emblem:'./character-emblems/grok.png'}),
  glm: Object.freeze({label:'智谱', emblem:'./character-emblems/glm.png'}),
});
export function characterIdentity(id) {
  return typeof id === 'string' && Object.hasOwn(CHARACTER_IDENTITIES,id) ? CHARACTER_IDENTITIES[id] : null;
}
export function characterDisplayName(id, fallback = '未知选手') {
  return characterIdentity(id)?.label ?? fallback;
}
/** Decorative beside the name; meaningful alt text when the emblem stands alone. */
export function characterEmblem(id, decorative = true) {
  const identity = characterIdentity(id);
  return identity ? `<img class="character-emblem" src="${identity.emblem}" width="128" height="128" alt="${decorative ? '' : `${identity.label}纹章`}"${decorative ? ' aria-hidden="true"' : ''} decoding="async" draggable="false">` : '';
}
