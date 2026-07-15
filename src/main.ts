import App from './ui/App.svelte';
import { LocalGameClient } from './game/client/local-game-client.ts';
import { loadFromLocalStorage } from './game/systems/save-system.ts';

const savedState = loadFromLocalStorage();
const gameClient = new LocalGameClient(savedState ?? undefined);

const app = new App({
  target: document.getElementById('app') as HTMLElement,
  props: { gameClient },
});

export default app;
