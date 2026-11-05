// Tailwind class lists used in several places, so every button and card looks
// the same. Change the look here once instead of in every file.
// (The colour names like bg-accent come from app/globals.css.)

/** A white (or dark) rounded box. */
export const card = "rounded-2xl border border-line bg-card p-5";

// min-h-12 = 48px tall: a comfortable tap target for a thumb.
// text-base (16px) on inputs stops iPhones from zooming in when you tap them.
export const buttonPrimary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-base font-medium text-accent-ink transition hover:opacity-90 disabled:opacity-60";

export const buttonSecondary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line px-4 text-base font-medium text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

export const input =
  "mt-1 min-h-12 w-full rounded-xl border border-line bg-page px-3 text-base text-ink outline-none placeholder:text-muted focus:border-accent";

export const label = "block text-sm font-medium text-ink";

export const link = "font-medium text-accent underline-offset-4 hover:underline";
