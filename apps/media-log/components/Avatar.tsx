// A round placeholder avatar: the first letter of the name on a gradient.
// (Real uploaded avatars come later.) Pure layout, no state.

const SIZES = {
  sm: "h-9 w-9 text-base",
  md: "h-12 w-12 text-xl",
  lg: "h-24 w-24 text-4xl",
} as const;

export function Avatar({ name, size = "sm" }: { name: string; size?: keyof typeof SIZES }) {
  // Skip a leading "@" so "@ana" shows "A", not "@".
  const letter = name.replace(/^@/, "").charAt(0);
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-600 font-bold uppercase ${SIZES[size]}`}
    >
      {letter}
    </div>
  );
}
