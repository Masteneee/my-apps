// Pure helper for the "suggest a question" form.
// The Formspree form ID comes from the PUBLIC_FORMSPREE_ID environment variable.
// If it's missing or doesn't look like an ID, we return null and the page shows a friendly
// message instead of a form that would fail when submitted.

// Formspree IDs are short strings of letters and digits, like "xyzabcde".
const FORM_ID = /^[A-Za-z0-9]+$/;

export function formspreeAction(formId: string | undefined | null): string | null {
  const id = (formId ?? '').trim();
  if (!FORM_ID.test(id)) return null;
  return `https://formspree.io/f/${id}`;
}
