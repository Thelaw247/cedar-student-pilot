# Withdrawn features

Kept on disk for later reintegration. Nothing in this directory is deployed.

## academic_assistant.jsonc.bak
The Academic Assistant agent. Withdrawn alongside the AI chat feature: no
per-message price is set and the feature is not working correctly yet.

It was withdrawn because it was the last UNGATED LLM surface in the app.
Unlike `academicAIChat` (which has a server-side ACADEMIC_CHAT_ENABLED kill
switch) a Base44 agent is a platform primitive with no enable flag in its
config, and `base44.agents.createConversation({ agent_name: 'academic_assistant' })`
is callable from any signed-in browser console regardless of whether any UI
mounts it. Deleting the file is what removes it from deployment.

To reintegrate: decide a per-message credit cost, add it to FEATURE_COSTS and
to the UsageEvent.feature enum, meter the agent server-side, then copy this
file back to base44/agents/academic_assistant.jsonc.
