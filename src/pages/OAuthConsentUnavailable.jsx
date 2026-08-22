import React from "react";
import { ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

// The exported OAuth consent screen belongs to Base44's MCP server. It is not
// part of the Supabase/Render authentication surface and must not issue Base44
// API requests from the isolated Cloudflare staging build.
export default function OAuthConsentUnavailable() {
  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Authorization unavailable"
      subtitle="This Base44 authorization flow is not available in the isolated staging environment."
    />
  );
}
