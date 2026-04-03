export function Footer() {
  return (
    <footer className="border-t border-[var(--zetrix-border)] py-6">
      <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 sm:flex-row">
        <span className="text-xs font-normal text-[var(--zetrix-text-light)]">
          Protected by Cloudflare
        </span>
        <span className="text-xs font-normal text-[var(--zetrix-text-light)]">
          Powered by Zetrix Blockchain
        </span>
      </div>
    </footer>
  );
}
