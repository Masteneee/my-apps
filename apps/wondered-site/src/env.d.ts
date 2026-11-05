// Tells TypeScript which environment variables exist, so typos get caught.
// The ? means it's allowed to be missing (the suggest page shows a fallback then).
interface ImportMetaEnv {
  readonly PUBLIC_FORMSPREE_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
