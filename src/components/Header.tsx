import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

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

  const linkCls = "text-sm text-muted-foreground hover:text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md";

  const navLinks = (onClick?: () => void) => (
    <>
      <Link to="/" onClick={onClick} className={linkCls}>Explore</Link>
      {user ? (
        <>
          <Link to="/tickets" onClick={onClick} className={linkCls}>Tickets</Link>
          {hasAny && <Link to="/my-events" onClick={onClick} className={linkCls}>My Events</Link>}
          {hasHost && (
            <>
              <Link to="/dashboard" onClick={onClick} className={linkCls}>Dashboard</Link>
              <Link to="/moderation" onClick={onClick} className={linkCls}>Moderation</Link>
            </>
          )}
          <Button variant="outline" size="sm" onClick={async () => { onClick?.(); await signOut(); navigate({ to: "/" }); }}>Sign out</Button>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm"><Link to="/signin" onClick={onClick} search={{ redirect: path }}>Sign in</Link></Button>
          <Button asChild size="sm"><Link to="/signup" onClick={onClick} search={{ redirect: path }}>Sign up</Link></Button>
        </>
      )}
    </>
  );

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          Gather
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center gap-2">
          {navLinks()}
        </nav>

        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile" className="md:hidden border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1 items-stretch">
            {navLinks(() => setOpen(false))}
          </div>
        </nav>
      )}
    </header>
  );
}
