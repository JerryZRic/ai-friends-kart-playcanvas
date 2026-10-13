import {getDocumentMusic} from './music-ui';

// Independent of the PlayCanvas/garage graph: resume the menu theme promptly.
// The garage later obtains this same document-scoped controller.
getDocumentMusic(document, undefined, true)?.setPhase('menu');

// Dynamic import keeps Vite from merging the heavyweight graph into this entry.
void import('./kart-garage');
