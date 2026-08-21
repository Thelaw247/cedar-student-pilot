import express from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature, getBalance } from '../lib/credits.js';

// Direct port of base44/functions/generateProjectRoadmap/entry.ts. Phase 1
// (field discovery) is free — a setup step, not the deliverable. Only Phase
// 2 (the actual roadmap) is billable.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { description, project_metadata, class_name, due_date } = req.body || {};
    if (!description) return res.status(400).json({ error: 'description is required' });

    if (!project_metadata) {
      const discoveryUsage = createLlmUsage();
      const discoveryGate = { ok: true, balance: await getBalance(userId), cost: 0, startedAt: Date.now(), operationId: crypto.randomUUID() };
      const result = await invokeLLM({
        usage: discoveryUsage,
        prompt: `You are a project planning assistant for university students. A student needs to complete a project.

Project Description: "${description}"
Class: ${class_name || 'Unknown'}

Based on this description, determine what additional information is needed to create a detailed step-by-step roadmap. Generate 2-5 custom fields.

Each field:
- key: snake_case identifier (e.g. "num_slides", "topics", "programming_language")
- label: a clear question for the student (e.g. "How many slides do you need?")
- type: "text" for open-ended, "number" for numeric, "choice" for multiple choice
- required: true if essential, false if optional
- options: array of strings (ONLY for "choice" type)

Examples by project type:
- Google Slides presentation: topics (text), num_slides (number), audience (text), design_style (choice)
- Code/project: programming_language (choice), features (text), platform (choice)
- Research paper: topic (text), page_count (number), citation_style (choice)
- Physical build project: materials (text), dimensions (text), budget (number)

Only generate fields that are genuinely needed for THIS specific project. Do not ask for information already in the description.`,
        response_json_schema: { type: 'object', properties: { fields: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' }, type: { type: 'string', enum: ['text', 'number', 'choice'] }, required: { type: 'boolean' }, options: { type: 'array', items: { type: 'string' } } } } } } },
      });
      await settleFeature(discoveryGate, { feature: 'project_roadmap', llmUsage: discoveryUsage });
      return res.json({ fields: result.fields || [] });
    }

    const gate = await gateFeature(userId, 'project_roadmap', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const metadataStr = Object.entries(project_metadata).map(([k, v]) => `- ${k}: ${v}`).join('\n');

    const result = await invokeLLM({
      usage: llmUsage,
      prompt: `You are a project planning assistant. Create a step-by-step roadmap for a student to complete their project.

Project Description: "${description}"
Additional Details:
${metadataStr}

Due Date: ${due_date || 'Not specified'}

Create 3-6 roadmap steps that guide the student from start to finish. Each step must be:
- A concrete, actionable task (e.g. "Research Topic", "Find Slides Template")
- Something completable in a single work session
- Ordered logically (research/prep first, polish/finalize last)

Common patterns by type:
- Google Slides: Research Topic → Find Template → Build Slide Structure → Populate Content → Review & Polish
- Code Project: Research/Design → Set Up Environment → Build Core Features → Test & Debug → Document
- Research Paper: Research → Outline → Write Draft → Add Citations → Edit & Finalize
- Build Project: Gather Materials → Design/Plan → Build → Test → Final Polish

Each step needs:
- title: short, action-oriented (2-4 words)
- description: what to do in this session (1-2 sentences with specifics from the project details)
- estimated_minutes: realistic time estimate (30-120 minutes)`,
      response_json_schema: { type: 'object', properties: { roadmap: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, estimated_minutes: { type: 'number' } } } } } },
    });

    await settleFeature(gate, { feature: 'project_roadmap', llmUsage });

    res.json({ roadmap: result.roadmap || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
