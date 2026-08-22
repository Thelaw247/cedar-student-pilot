import { createAxiosClient } from "@base44/sdk/dist/utils/axios-client";
import { appParams } from "@/lib/app-params";

// Kept behind a build-time alias so only the default Base44 build imports the
// SDK helper and bootstrap parameters.
export async function getAppPublicSettings() {
  const appClient = createAxiosClient({
    baseURL: "/api/apps/public",
    headers: { "X-App-Id": appParams.appId },
    token: appParams.token,
    interceptResponses: true,
  });

  return appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
}

export const hasAppToken = () => Boolean(appParams.token);
