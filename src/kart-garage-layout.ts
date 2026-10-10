/** Garage uses the same reference layout and lifecycle as every other screen. */
import {UI_DESIGN_WIDTH, UI_DESIGN_HEIGHT, uiLayout, mountUiLayout, type UiLayout} from './ui-layout';
export const GARAGE_DESIGN_WIDTH = UI_DESIGN_WIDTH;
export const GARAGE_DESIGN_HEIGHT = UI_DESIGN_HEIGHT;
export const GARAGE_DIALOG_WIDTH = 820;
export const GARAGE_DIALOG_HEIGHT = 720;
export type GarageLayout = UiLayout;
export const garageLayout = uiLayout;
export function garageDialogBounds(layout: GarageLayout) {
  const width = GARAGE_DIALOG_WIDTH * layout.scale, height = GARAGE_DIALOG_HEIGHT * layout.scale;
  return {left: layout.centerX - width / 2, top: layout.centerY - height / 2, width, height, scale: layout.scale};
}
const garageProperties = ['--garage-ui-scale', '--garage-ui-left', '--garage-ui-top', '--garage-ui-center-x', '--garage-ui-center-y', '--garage-design-width', '--garage-design-height'];
export function mountGarageLayout(root: HTMLElement, onChange?: (layout: GarageLayout) => void, host: Window = window) {
  return mountUiLayout(root, onChange, host, garageProperties);
}
