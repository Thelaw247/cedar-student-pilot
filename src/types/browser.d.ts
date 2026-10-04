// Browser APIs the app reads that TypeScript's DOM library does not declare.
// Both are optional: most browsers do not have them, and the code checks.

interface Navigator {
  /** Network Information API (Chromium). `saveData` is the data saver setting: the hero shows its poster instead of the demo video. */
  readonly connection?: { readonly saveData?: boolean };
  /** Global Privacy Control (Firefox, Brave, DuckDuckGo). `true` means no analytics until the visitor turns them on in Settings. */
  readonly globalPrivacyControl?: boolean;
}
