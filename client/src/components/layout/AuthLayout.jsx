/** Centred card used by the screens a person sees before they are fully signed in. */
export default function AuthLayout({ title, description, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-flood font-display text-2xl text-turf-900"
          >
            EL
          </span>
          <h1 className="font-display text-4xl leading-none">{title}</h1>
          {description && <p className="mt-2 text-sm text-mist">{description}</p>}
        </div>
        <div className="rounded-xl border border-line bg-turf-800 p-6 shadow-panel">{children}</div>
      </div>
    </main>
  );
}
