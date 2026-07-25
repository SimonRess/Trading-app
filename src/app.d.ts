// eslint-disable-next-line import/no-default-export
declare module '*.svelte' {
  import type { ComponentType } from 'svelte';
  const component: ComponentType;
  export default component;
}

declare module '*.md?raw' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}
