"use client";

type EmbeddedDashboardFrameProps = {
  title: string;
  description: string;
  mountPath: string;
};

function buildMountedUrl(mountPath: string) {
  const token = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN?.trim();
  if (!token) {
    return mountPath;
  }
  return `${mountPath}#token=${encodeURIComponent(token)}`;
}

export function EmbeddedDashboardFrame({
  title,
  description,
  mountPath,
}: EmbeddedDashboardFrameProps) {
  const mountedUrl = buildMountedUrl(mountPath);

  return (
    <div className="h-full min-h-screen p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        </div>
        <a
          href={mountedUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Open standalone
        </a>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
          height: "calc(100vh - 9rem)",
        }}
      >
        <iframe
          src={mountedUrl}
          title={title}
          className="h-full w-full border-0"
          referrerPolicy="same-origin"
        />
      </div>
    </div>
  );
}
