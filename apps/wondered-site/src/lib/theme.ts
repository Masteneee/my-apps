// Browser-only helpers for the dark mode toggle.
// localStorage can throw (private browsing, blocked storage), so every access is wrapped:
// if it fails, the toggle still works for this visit, it just isn't remembered.
const KEY = 'theme';

export function savedTheme(): 'light' | 'dark' | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: nothing to do, the page still switches.
  }
}
