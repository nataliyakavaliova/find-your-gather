import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignUp,
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/" }),
});

function SignUp() {
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Account created!"); window.location.href = redirect; }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl mb-6">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Sign up"}</Button>
      </form>
      <p className="text-sm text-muted-foreground mt-4">
        Have an account? <Link to="/signin" search={{ redirect }} className="text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
