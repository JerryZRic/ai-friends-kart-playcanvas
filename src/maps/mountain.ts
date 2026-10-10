import {createLandTrack} from '../land-track';

/** Original contour route: two terraced lobes connected by one high viaduct.
 * Coordinate units are metres; these are original authored knots, not traced assets.
 * The route travels over the central crossing first, then returns beneath it. */
export const MOUNTAIN_POINTS = [
  [220, 8, -220], [340, 9, -180], [400, 13, -70], [350, 20, 20],
  [260, 25, 65], [240, 29, 120], [290, 33, 160], [390, 37, 200],
  [410, 42, 290], [350, 46, 355], [250, 47, 340], [165, 46, 260],
  [90, 45, 150], [0, 44, 0], [-90, 42, -150], [-180, 36, -240],
  [-310, 29, -260], [-410, 23, -190], [-430, 19, -80], [-370, 16, -10],
  [-280, 13, 20], [-240, 11, 90], [-270, 9, 170], [-380, 8, 210],
  [-405, 8, 290], [-350, 8, 350], [-220, 8, 340], [-130, 8, 250],
  [0, 8, 0], [100, 8, -170],
] as const;

export const MOUNTAIN_TRACK = createLandTrack({
  id: 'mountain', label: '云岭盘山道', tag: 'CLOUDRIDGE PASS',
  points: MOUNTAIN_POINTS,
  widths: [[0, 9], [.07, 9], [.12, 8], [.19, 8], [.25, 9.5], [.31, 9.5], [.36, 8], [.43, 8], [.49, 9], [.55, 9], [.61, 8], [.67, 8], [.74, 9.5], [.80, 9.5], [.87, 8.5], [.95, 9], [1, 9]],
  sections: [
    {name: 'Valley grid straight', from: 0, to: .09},
    {name: 'Terraced climb and eastern hairpin', from: .09, to: .23},
    {name: 'Summit horseshoe', from: .23, to: .35},
    {name: 'Cloud viaduct upper deck', from: .35, to: .47},
    {name: 'Western downhill esses', from: .47, to: .64},
    {name: 'Pine switchback', from: .64, to: .76},
    {name: 'Granite basin hairpin', from: .76, to: .86},
    {name: 'Viaduct underpass and recovery straight', from: .86, to: 1},
  ],
  pickups: [.055, .145, .23, .31, .405, .505, .59, .69, .795, .91, .97].flatMap(d => [-3.5, 0, 3.5].map(lateral => ({d, lateral}))),
  surfaces: [
    {from: .52, to: .60, surface: {kind: 'rough-asphalt', grip: .94, rollingResistance: 1.13}},
    {from: .87, to: .92, surface: {kind: 'underpass-stone', grip: .97, rollingResistance: 1.06}},
  ],
  bankScale: 5,
});
