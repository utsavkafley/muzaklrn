import { Suspense } from "react";
import ModesClient from "./ModesClient";

// Same shape as /connect: useSearchParams needs a Suspense boundary above it on
// a prerendered route, so the shell ships static and only the client hydrates.
export default function ModesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-400">Modes</h1>
          <p className="text-sm text-neutral-500">Tuning up…</p>
        </div>
      }
    >
      <ModesClient />
    </Suspense>
  );
}
