import { analytics } from '@heycatch/sdk';

/**
 * HeyCatch, server side (https://heycatch.ai/agents.md).
 *
 * The browser has its own init in src/main.jsx; a server bundle needs one of
 * its own, once, at module scope. The project key is the same in both places
 * and is publishable by design — it identifies the project, it does not
 * authorise anything (server/test/analytics-install.test.js keeps the two
 * literals equal).
 *
 * What belongs here rather than in the browser: outcomes only the server
 * knows for certain. A subscription is the case in point — a Stripe webhook
 * arrives whether or not the student's tab is still open, and an ad blocker
 * can never eat a server event. Every call has to name the user id, because
 * that is what joins the event to the person the browser identified; the
 * calls never throw, so a failing analytics call cannot fail a webhook.
 *
 * Nothing about lectures, transcripts or files is ever sent from here: the
 * events are the paid outcomes and the plan they bought.
 */
analytics.init({ projectKey: 'hck_pk_DAwNG96mZXpjqzyKcLl-K5UIEoeRbPrB' });

export { analytics };
