/** Escapes user text so it is matched literally inside a regular expression. */
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
