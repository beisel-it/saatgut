import type { Metadata } from "next";
import Link from "next/link";

import { DEFAULT_LOCALE, messages } from "@/lib/i18n";
import { getOpenApiDocument } from "@/lib/server/openapi";

type HttpMethod = "get" | "post" | "patch" | "delete";

const methodStyles: Record<HttpMethod, string> = {
  get: "bg-emerald-100 text-emerald-900",
  post: "bg-sky-100 text-sky-900",
  patch: "bg-amber-100 text-amber-950",
  delete: "bg-rose-100 text-rose-900",
};

const methodOrder: HttpMethod[] = ["get", "post", "patch", "delete"];
const docs = messages[DEFAULT_LOCALE].docs;

export const metadata: Metadata = {
  title: docs.metaTitle,
  description: docs.metaDescription,
};

function getGroupLabel(path: string) {
  const segment = path.split("/").filter(Boolean)[0] ?? "misc";

  return segment === "auth"
    ? docs.groups.auth
    : segment === "admin"
      ? docs.groups.admin
      : segment === "workspace"
        ? docs.groups.workspace
        : segment === "mcp"
          ? docs.groups.mcp
          : docs.groups.data;
}

export default function ApiReferencePage() {
  const document = getOpenApiDocument();
  const groups = Object.entries(document.paths).reduce<Record<string, Array<{
    path: string;
    method: HttpMethod;
    summary: string;
    isPublic: boolean;
  }>>>((acc, [path, definition]) => {
    const group = getGroupLabel(path);
    const operationsByMethod = definition as Partial<Record<HttpMethod, {
      summary?: string;
      security?: unknown[];
    }>>;
    const operations = methodOrder.flatMap((method) => {
      const operation = operationsByMethod[method];

      if (!operation) return [];

      return [{
        path,
        method,
        summary: operation.summary ?? docs.noDescription,
        isPublic: Array.isArray(operation.security) && operation.security.length === 0,
      }];
    });

    acc[group] = [...(acc[group] ?? []), ...operations];
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,155,71,0.18),transparent_28%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-xl border border-[rgba(24,49,40,0.12)] bg-[color:rgba(253,249,240,0.94)] p-6 shadow-[0_22px_70px_rgba(35,50,35,0.12)] md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgba(24,49,40,0.54)]">
                {docs.eyebrow}
              </p>
              <div className="space-y-2">
                <h1 className="max-w-[18ch] text-3xl font-semibold tracking-tight text-[rgb(24,49,40)] md:text-4xl">
                  {docs.title}
                </h1>
                <p className="max-w-[60ch] text-sm leading-6 text-[rgba(24,49,40,0.72)] md:text-base">
                  {docs.subtitle}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-lg border border-[rgba(24,49,40,0.14)] px-4 py-2 text-sm font-semibold text-[rgb(24,49,40)]"
              >
                {docs.backToApp}
              </Link>
              <a
                href="/api/v1/openapi.json"
                className="rounded-lg bg-[rgb(24,49,40)] px-4 py-2 text-sm font-semibold text-white"
              >
                {docs.rawOpenApi}
              </a>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[rgba(24,49,40,0.1)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[rgb(24,49,40)]">{docs.securityTitle}</p>
              <p className="mt-2 text-sm leading-6 text-[rgba(24,49,40,0.72)]">{docs.securityCopy}</p>
            </div>
            <div className="rounded-lg border border-[rgba(24,49,40,0.1)] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[rgb(24,49,40)]">{docs.schemaTitle}</p>
              <p className="mt-2 text-sm leading-6 text-[rgba(24,49,40,0.72)]">{docs.schemaCopy}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groups).map(([group, operations]) => (
            <article
              key={group}
              className="rounded-xl border border-[rgba(24,49,40,0.12)] bg-white/82 p-5 shadow-[0_18px_50px_rgba(35,50,35,0.1)]"
            >
              <h2 className="text-lg font-semibold tracking-tight text-[rgb(24,49,40)]">{group}</h2>
              <div className="mt-4 space-y-3">
                {operations.map((operation) => (
                  <div
                    key={`${operation.method}:${operation.path}`}
                    className="rounded-lg border border-[rgba(24,49,40,0.1)] bg-[rgba(253,249,240,0.72)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${methodStyles[operation.method]}`}
                      >
                        {operation.method}
                      </span>
                      <span className="rounded-full bg-[rgba(24,49,40,0.08)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(24,49,40,0.72)]">
                        {operation.isPublic ? docs.publicBadge : docs.protectedBadge}
                      </span>
                    </div>
                    <code className="mt-3 block break-all text-sm font-semibold text-[rgb(24,49,40)]">
                      /api/v1{operation.path}
                    </code>
                    <p className="mt-2 text-sm leading-6 text-[rgba(24,49,40,0.72)]">{operation.summary}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
