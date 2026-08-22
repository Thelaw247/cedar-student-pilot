// Cloudflare staging has no Base44 application-state endpoint. Keeping this
// module SDK-free prevents the isolated build from bundling Base44 bootstrap
// and HTTP client code.
export async function getAppPublicSettings() {
  return { id: "cedar-student-pilot", public_settings: {} };
}

export const hasAppToken = () => false;
