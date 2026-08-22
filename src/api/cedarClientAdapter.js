// Cloudflare-only replacement for the Base44 SDK entrypoint.
//
// vite.config.js aliases every "@/api/base44Client" import to this module in
// cloudflare mode. Keeping the adapter separate means the isolated bundle never
// imports or initializes @base44/sdk, while the default Base44 build continues
// to use src/api/base44Client.js unchanged.
export { cedar as base44 } from "@/lib/cedarClient";
export const usingSupabase = true;
