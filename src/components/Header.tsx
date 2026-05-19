import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: memberships } = useQuery({
    queryKey: ["nav-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("host_members").select("role").eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const hasAny = (memberships ?? []).length > 0;
  const hasHost = (memberships ?? []).some((m) => m.role === "host");

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Gather
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Explore</Link>
          {user ? (
            <>
              <Link to="/tickets" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Tickets</Link>
              {hasAny && (
                <Link to="/my-events" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">My Events</Link>
              )}
              {hasHost && (
                <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Dashboard</Link>
              )}
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>Sign out</Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/signin" search={{ redirect: path }}>Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/signup" search={{ redirect: path }}>Sign up</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
