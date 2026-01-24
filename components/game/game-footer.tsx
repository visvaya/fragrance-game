export function GameFooter() {
  return (
    <footer className="w-full bg-secondary border-t border-border mt-auto pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-[640px] mx-auto px-5 py-10 flex flex-col items-center gap-4">
        {/* Links */}
        <div className="flex gap-6">
          <a
            href="#"
            className="font-[family-name:var(--font-playfair)] italic text-sm text-foreground hover:text-primary hover:underline transition-colors duration-300"
          >
            Contact
          </a>
          <a
            href="#"
            className="font-[family-name:var(--font-playfair)] italic text-sm text-foreground hover:text-primary hover:underline transition-colors duration-300"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="font-[family-name:var(--font-playfair)] italic text-sm text-foreground hover:text-primary hover:underline transition-colors duration-300"
          >
            Terms
          </a>
        </div>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground">© 2025 Eauxle. Designed for Fragheads.</p>

        {/* Decorative handwritten note */}
        <p className="font-[family-name:var(--font-hand)] text-lg text-primary/60 mt-2 rotate-[-2deg]">
          Train your nose, one day at a time
        </p>
      </div>
    </footer>
  )
}
