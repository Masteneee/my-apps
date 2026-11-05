import Link from "next/link";

const MEDIA_TYPES = ["Movies", "Series", "Anime", "Manga", "Books", "Games"];

// The home page. It has no "use client", so it's a Server Component: Next.js
// turns it into plain HTML and sends no JavaScript for it.
export default function HomePage() {
  return (
    <section className="py-10 text-center sm:py-20">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
        Everything you watch, read <span className="text-violet-400">and play.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
        One diary, one profile, one taste. Log and rate movies next to anime, manga, books and games.
      </p>

      <ul className="mt-8 flex flex-wrap justify-center gap-2">
        {MEDIA_TYPES.map((type) => (
          <li key={type} className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300">
            {type}
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/signup" className="rounded-md bg-violet-500 px-6 py-3 font-medium text-white hover:bg-violet-400">
          Create your profile
        </Link>
        <Link href="/login" className="rounded-md border border-zinc-700 px-6 py-3 font-medium hover:bg-zinc-800">
          I have an account
        </Link>
      </div>
    </section>
  );
}
