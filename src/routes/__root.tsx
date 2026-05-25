import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This event has wandered off.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Back home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gather — Free community events" },
      { name: "description", content: "Discover and host free community events near you." },
      { property: "og:title", content: "Gather — Free community events" },
      { property: "og:description", content: "Discover and host free community events near you." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Gather — Free community events" },
      { name: "twitter:description", content: "Discover and host free community events near you." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6eb143ca-3b7e-4126-825d-d767adf2a0b1/id-preview-24bb2f80--33919458-04f8-4f0b-8538-1a59efa6dd0e.lovable.app-1779088241829.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6eb143ca-3b7e-4126-825d-d767adf2a0b1/id-preview-24bb2f80--33919458-04f8-4f0b-8538-1a59efa6dd0e.lovable.app-1779088241829.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-dvh flex flex-col">
          <Header />
          <main className="flex-1"><Outlet /></main>
          <footer className="border-t border-border bg-background">
            <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
              <div className="font-display text-foreground">Gather</div>
              <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link to="/" className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Explore</Link>
                <Link to="/signup" className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Sign up</Link>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">GitHub</a>
              </nav>
              <a href="https://lovable.dev" target="_blank" rel="noreferrer" className="hover:text-foreground">Built with Lovable</a>
            </div>
          </footer>
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
