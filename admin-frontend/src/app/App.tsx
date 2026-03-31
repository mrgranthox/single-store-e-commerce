import * as Sentry from "@sentry/react";

import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";

export const App = () => (
  <Sentry.ErrorBoundary
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] p-6">
        <div className="w-full max-w-lg rounded-2xl border border-[#e0e2f0] bg-white p-8 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#737685]">Admin workspace</p>
          <h1 className="mt-2 font-headline text-2xl font-bold tracking-tight text-[#181b25]">
            Unexpected application error
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5b5e68]">
            A rendering failure interrupted the admin app. Refresh the page to recover.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-[#1653cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1653cc]/90"
          >
            Reload page
          </button>
        </div>
      </div>
    }
  >
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </Sentry.ErrorBoundary>
);
