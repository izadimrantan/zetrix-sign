import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/50 py-6">
      <div className="container mx-auto flex flex-col items-center gap-2 px-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Powered by Zetrix Blockchain</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Zetrix Sign. All rights reserved.</p>
      </div>
    </footer>
  );
}
