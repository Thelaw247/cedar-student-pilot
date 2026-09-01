/**
 * Native theme tokens.
 *
 * These are the same values as the .landing-surface / .auth-surface blocks in
 * src/index.css, converted from HSL to hex because React Native has no CSS
 * custom properties and no hsl() string support in all style positions.
 *
 * Kept as a hand-maintained mirror rather than generated, deliberately: the web
 * tokens live in a Tailwind/CSS pipeline that has no meaning here, and a build
 * step to convert them would be more machinery than a dozen colours justify.
 * A test asserts the primary matches the web token so the brand blue cannot
 * drift between the two apps unnoticed.
 *
 * The primary is 224 100% 67%, not the original 59%: that was lifted to clear
 * WCAG AA as text on the dark ground (5.47:1 against 3.97:1). Same hue and
 * saturation, so it is recognisably the same blue.
 */

export const colors = {
  background: '#0E121B',   // 222 33% 8%
  card: '#151A26',         // 222 30% 11%
  cardElevated: '#1A2030',
  border: '#2E3849',       // 218 22% 24%
  input: '#2E3849',
  primary: '#578AFF',      // 224 100% 67%
  primaryPressed: '#3C74F5',
  primaryForeground: '#FFFFFF',
  foreground: '#EFF3F9',   // 210 40% 96%
  muted: '#8E9AAF',        // 215 18% 64%
  secondary: '#1C2231',    // 222 26% 14%
  destructive: '#F06A6A',  // 0 72% 63%
  success: '#3ECB80',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, card: 20, modal: 24, pill: 999 };

export const type = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '400' },
  small: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
};
