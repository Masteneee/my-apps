// A round placeholder avatar: the first letter of the name. Pure layout, no state.

const SIZES = {
  sm: "h-10 w-10 text-base",
  lg: "h-20 w-20 text-3xl",
} as const;

export function Avatar({ name, size = "sm" }: { name: string; size?: keyof typeof SIZES }) {
  // Skip a leading "@" so "@ana" shows "A", not "@".
  const letter = name.replace(/^@/, "").charAt(0);
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent uppercase ${SIZES[size]}`}
    >
      {letter}
    </div>
  );
}
