import {getDocumentMusic} from './music-ui';
import {isMenuGarageFrame} from './garage-host-protocol';
const embedded = isMenuGarageFrame();
if (!embedded) getDocumentMusic(document, undefined, true)?.setPhase('menu');
void import('./kart-garage').then(({mountKartGarage}) => {
  if (embedded && !isMenuGarageFrame()) return; // Removed while the module loaded.
  const root = document.getElementById('kart-garage'); if (!root) return;
  const garage = mountKartGarage(root);
  if (embedded) {
    window.__disposeEmbeddedGarage = garage.dispose;
    window.parent.postMessage({type:'kart-garage:ready'}, location.origin === 'null' ? '*' : location.origin);
  }
});
