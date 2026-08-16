import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import { gateFeature, settleFeature } from '../../shared/credits.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // timetable_import costs 0 by design — this runs during onboarding and must
    // never be blocked. The gate passes automatically; it is here so the call
    // still lands in UsageEvent and its real cost stays visible in the margin
    // numbers rather than being invisible spend.
    const gate = await gateFeature(base44, user.id, 'timetable_import');
    if (!gate.ok) return gate.response!;

    // NOT migrated to shared/llm.ts on purpose. This is the only vision call in
    // the app — it passes `file_urls` so the model can read a photo of a
    // timetable — and invokeLLM() is text-only, so routing it through would
    // silently drop the image and break onboarding. It runs once per signup and
    // is deliberately ungated (gating onboarding kills activation), so the ~3
    // Base44 credits it costs are acceptable. Migrate only after invokeLLM()
    // grows Gemini inline-image support.
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an expert at reading university class timetables. Analyze the provided timetable image or document and extract ALL classes/courses shown.

For each class, extract:
- name: The course name (e.g. "Introduction to Biology")
- instructor: The professor/instructor name if available
- room: The classroom or location if available
- days_of_week: Array of days the class meets (use abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- start_time: Start time in 24-hour HH:MM format
- end_time: End time in 24-hour HH:MM format

Return a JSON object with a "classes" array containing all extracted classes. If you cannot read the timetable or it's unclear, return an empty array.

Be thorough — capture every class on the timetable. If days aren't explicitly listed but the class appears to recur, infer standard weekday patterns.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          classes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                instructor: { type: 'string' },
                room: { type: 'string' },
                days_of_week: { type: 'array', items: { type: 'string' } },
                start_time: { type: 'string' },
                end_time: { type: 'string' }
              }
            }
          }
        }
      }
    });

    await settleFeature(base44, gate, {
      feature: 'timetable_import',
      calls: 1,
      // This is the one vision call in the app and it does NOT route through
      // invokeLLM, so it always bills Base44 integration credits regardless of
      // whether GEMINI_API_KEY is set.
      usedGemini: false,
    });

    return Response.json({ classes: result.classes || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});