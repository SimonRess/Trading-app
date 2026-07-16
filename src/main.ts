import App from './ui/App.svelte';
import { LocalGameClient } from './game/client/local-game-client.ts';
import { loadFromLocalStorage } from './game/systems/save-system.ts';

const savedState = loadFromLocalStorage();
const gameClient = new LocalGameClient(savedState ?? undefined);

// eslint-disable-next-line import/no-default-export
new App({
  target: document.getElementById('app') as HTMLElement,
  props: { gameClient },
});
