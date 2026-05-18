import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Gather
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
            Explore
          </Link>
          {user ? (
            <>
              <Link to="/tickets" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
                Tickets
              </Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
                Dashboard
              </Link>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/signin" search={{ redirect: path }}>Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup" search={{ redirect: path }}>Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
