import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DemoClock } from "@/components/DemoClock";
import type { Language } from "@/lib/types";

export default async function Home() {
  const supabase = createClient();
  const [{ data: languages }, { data: { user } }] = await Promise.all([
    supabase.from("languages").select("*").order("name"),
    supabase.auth.getUser(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <header className="flex items-center justify-between">
        <span className="font-mono text-sm tracking-[0.3em] text-lamp">INPUT·TV</span>
        {user ? (
          <span className="text-sm text-dust">{user.email}</span>
        ) : (
          <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
        )}
      </header>

      <section className="mt-20 sm:mt-28">
        <h1 className="font-display text-5xl sm:text-7xl leading-[1.05]">
          Fluency is a number
          <br />
          of hours.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-dust">
          Comprehensible input works when you watch a lot of it, at your level.
          inputtv tunes YouTube to where you are — and keeps the clock running.
        </p>
        <div className="mt-10">
          <DemoClock />
          <p className="mt-2 font-mono text-xs tracking-widest text-dust/70">
            HOURS · MIN · SEC OF INPUT
          </p>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-mono text-xs tracking-[0.3em] text-dust">CHOOSE A CHANNEL</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(languages as Language[] | null)?.map((l) => (
            <Link
              key={l.code}
              href={user ? `/learn/${l.code}` : `/login?next=/learn/${l.code}`}
              className="card flex items-center gap-3 px-5 py-4"
            >
              <span className="text-2xl">{l.flag}</span>
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="font-mono text-[10px] tracking-widest text-dust uppercase">
                  ch·{l.code}
                </div>
              </div>
            </Link>
          ))}
          {!languages?.length && (
            <p className="col-span-full text-dust">
              No languages yet — run <code className="text-lamp">supabase/seed.sql</code> and{" "}
              <code className="text-lamp">npm run ingest</code>.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
