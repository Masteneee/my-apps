import type { Metadata } from "next";
import Link from "next/link";
import { card, link } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

// The privacy note, in plain language (Stage 5). Same content as PRIVACY.md at
// the root of the app folder: if you change one, change the other.
// A plain server page (no "use client"): it's the same text for everyone, so
// Next.js builds it once, and the service worker saves it for offline use.

const h2 = "font-semibold";
const list = "mt-2 list-disc space-y-2 pl-5 text-sm";

export default function PrivacyPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Privacy</h1>
        <p className="mt-1 text-sm text-muted">What this app keeps, who can see it, and how to take it with you or delete it.</p>
      </header>

      <section className={card}>
        <h2 className={h2}>The short version</h2>
        <ul className={list}>
          <li>
            Your <strong>journal</strong>, gratitudes, mood and screen time are <strong>only for you</strong>. Friends never
            see them.
          </li>
          <li>No ads, no trackers, no analytics, no AI. Insights are simple averages worked out on your own phone.</li>
          <li>You can download all of it any time (Profile &gt; Your data).</li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>What is stored</h2>
        <ul className={list}>
          <li>
            <strong>Your account:</strong> email, username and display name. Your password is handled by Supabase (the
            login service) and stored scrambled (&quot;hashed&quot;); the app never keeps it.
          </li>
          <li>
            <strong>Check-ins:</strong> for each day, your mood and mood words, screen time, 3 gratitudes and your
            journal.
          </li>
          <li>
            <strong>Habits:</strong> their names, emoji and goals, and which days you did them (with the amount).
          </li>
          <li>
            <strong>Friends:</strong> who you&apos;re friends with, requests, and your shared streaks (which habit, with whom).
          </li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>Who can see what</h2>
        <ul className={list}>
          <li>
            <strong>Only you:</strong> your journal, gratitudes, mood, mood words, screen time, your habit amounts and
            goals. The database itself enforces this (&quot;Row Level Security&quot;), not just the app.
          </li>
          <li>
            <strong>Your friends:</strong> your username and display name, and, only for a habit you chose to share with
            them, which days you did it. Nothing else.
          </li>
          <li>
            <strong>Other people with an account:</strong> your username and display name, so friends can find you.
          </li>
          <li>
            <strong>The person running this app:</strong> the data is stored in their Supabase project. It isn&apos;t
            end-to-end encrypted, so they could technically open the database. They promise not to read it, but you
            should know it&apos;s possible.
          </li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>Demo mode</h2>
        <p className="mt-2 text-sm">
          When the strip at the top says &quot;Demo mode&quot;, nothing goes online at all: your account and every answer
          are saved only in this browser (its &quot;localStorage&quot;). Anyone using this browser on this device could see
          them, and clearing the browser&apos;s data erases them.
        </p>
      </section>

      <section className={card}>
        <h2 className={h2}>What stays on your phone</h2>
        <ul className={list}>
          <li>To work offline, the app saves its pages (the same for everyone, never your answers).</li>
          <li>
            Answers you save while offline wait on your phone and are deleted as soon as they reach the server. A copy of
            your habit names is kept so the check-in works offline.
          </li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>Take your data with you</h2>
        <p className="mt-2 text-sm">
          <Link href="/profile" className={link}>
            Profile
          </Link>{" "}
          &gt; Your data &gt; <strong>JSON</strong> (everything, for a backup) or <strong>CSV</strong> (one row per day, for
          Excel or Google Sheets). The file has your account, habits, check-ins (journal included) and habit entries.
          Friends and shared streaks aren&apos;t in it, because they involve another person.
        </p>
      </section>

      <section className={card}>
        <h2 className={h2}>Delete your data</h2>
        <ul className={list}>
          <li>
            <strong>Demo mode:</strong> clear this site&apos;s data in your browser (Settings &gt; Privacy &gt; Site data, or
            in Chrome: the icon left of the address &gt; Site settings &gt; Delete data). Everything is gone.
          </li>
          <li>
            <strong>With an account:</strong> remove a friend and your shared streaks with them are deleted. To delete
            everything, ask the person running this app to delete your account: your profile, habits, check-ins, habit
            entries and friendships are then all deleted with it. There&apos;s no delete button in the app yet. Download
            your data first if you want to keep it.
          </li>
          <li>Logging out doesn&apos;t delete anything. On a shared computer, clear the site&apos;s data afterwards too.</li>
        </ul>
      </section>
    </div>
  );
}
