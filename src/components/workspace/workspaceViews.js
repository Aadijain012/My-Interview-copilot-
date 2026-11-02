// The signed-in app's views, as kept in the URL (?window=...).
//
// The Workspace is the signed-in home: sign-in and sign-up end there unless
// they were started for a particular tool, and the app's earlier homes (the
// signed-in homepage, ?window=auth, and the old dashboard, ?window=dashboard)
// open it too, so saved links keep working.

export const WORKSPACE_VIEW = 'workspace';

// The four tools, by ?window= value.
export const TOOL_VIEWS = Object.freeze(['overlay', 'voice-agent', 'notetaker', 'upload']);

const SIGNED_IN_VIEWS = Object.freeze([WORKSPACE_VIEW, ...TOOL_VIEWS, 'profile', 'credits']);

/** The view to show a signed-in person for a ?window= value. */
export function resolveSignedInView(view) {
  return SIGNED_IN_VIEWS.includes(view) ? view : WORKSPACE_VIEW;
}

/**
 * Where a sign-in or sign-up ends. A link made for one tool (a product button
 * on the homepage, or ?window=<tool> on an entry link) keeps that tool; every
 * other sign-in opens the Workspace.
 */
export function signInDestination(requested) {
  return TOOL_VIEWS.includes(requested) ? requested : WORKSPACE_VIEW;
}
