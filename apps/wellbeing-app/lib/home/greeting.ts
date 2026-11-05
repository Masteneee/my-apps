// Small pure helpers for the home page. "Pure" = same input, same output,
// so they're easy to test (greeting.test.ts).

/** "Good morning" before noon, "Good afternoon" until 6 pm, then "Good evening". */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening"; // includes the middle of the night (0 to 4 am)
}

/** The name to greet: the display name if there is one, else the username. */
export function nameToShow(profile: { username: string; display_name: string | null }): string {
  return profile.display_name?.trim() || profile.username;
}
