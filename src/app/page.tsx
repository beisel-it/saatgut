const stackItems = [
  "Next.js 15 App Router shell",
  "Prisma schema for the seed-bank MVP domain",
  "PostgreSQL 16 via Docker Compose",
  "Health endpoint and container health checks",
  "GitHub Actions CI baseline",
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 rounded-[2rem] border border-[var(--border)] bg-[var(--muted)]/90 p-8 shadow-[var(--shadow)] backdrop-blur md:p-12">
        <div className="flex flex-col gap-4 md:max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--accent-strong)]">
            Saatgut MVP
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Seed-bank infrastructure is in place for the first delivery slice.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[color:rgba(24,49,40,0.78)] md:text-lg">
            This scaffold provides the agreed runtime baseline only: a single Next.js
            application, Prisma and PostgreSQL wiring, container orchestration, and CI
            verification for the repository.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/80 p-6">
            <h2 className="text-xl font-semibold">Baseline modules</h2>
            <ul className="mt-4 grid gap-3">
              {stackItems.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[color:rgba(127,155,71,0.14)] p-6">
            <h2 className="text-xl font-semibold">Next implementation targets</h2>
            <div className="mt-4 space-y-4 text-sm leading-6">
              <p>Authentication and workspace bootstrap.</p>
              <p>Catalog, seed batch, and growing profile CRUD flows.</p>
              <p>Calendar calculation and planting event capture.</p>
            </div>
            <div className="mt-6 rounded-2xl bg-[var(--foreground)] px-4 py-3 text-sm text-white">
              Health endpoint: <code>/api/health</code>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
