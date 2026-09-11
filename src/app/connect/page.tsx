import { Suspense } from "react";
import ConnectClient from "./ConnectClient";

// useSearchParams needs a Suspense boundary above it on a prerendered route,
// so the shell ships as static HTML and only the client part hydrates.
export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-400">Connect</h1>
          <p className="text-sm text-neutral-500">Loading the neck…</p>
        </div>
      }
    >
      <ConnectClient />
    </Suspense>
  );
}
