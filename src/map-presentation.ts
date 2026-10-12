import {resolveMap, type MapId} from './map-profiles';

/** Display order and codes only. Map IDs, profile order and saved URLs stay stable. */
export const MAP_MENU_ORDER: readonly MapId[] = Object.freeze([
  'coast', 'mountain', 'town', 'quarry', 'forest', 'workshop', 'harvest',
  'desert', 'snow', 'caldera', 'garden', 'airfield', 'waterpark',
]);

export const MAP_DISPLAY_CODES: Readonly<Record<MapId, string>> = Object.freeze({
  coast: '01', mountain: '02', town: '03', quarry: '04', forest: '05',
  workshop: '06', harvest: '07', desert: '08', snow: '09', caldera: '10',
  garden: '11', airfield: '12', waterpark: 'A01',
});

export const MAP_CATALOG = Object.freeze(MAP_MENU_ORDER.map(id =>
  Object.freeze({...resolveMap(id), displayCode: MAP_DISPLAY_CODES[id]}),
));
