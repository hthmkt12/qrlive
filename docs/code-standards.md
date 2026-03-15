# Code Standards & Patterns

---

## File Structure

```
src/
├── pages/                    # Route-level components
│   ├── Index.tsx            # Dashboard (protected route)
│   ├── Auth.tsx             # Login/signup form
│   └── NotFound.tsx         # 404 fallback
├── components/              # Reusable UI components
│   ├── LinkCard.tsx         # Single link display + actions
│   ├── CreateLinkDialog.tsx # Create link modal
│   ├── EditLinkDialog.tsx   # Edit link modal
│   ├── StatsPanel.tsx       # Analytics view
│   ├── QRPreview.tsx        # QR code generator
│   └── ui/                  # shadcn/ui components (45 files)
├── contexts/                # React Context providers
│   └── auth-context.tsx     # Auth state + methods
├── hooks/                   # Custom React hooks
│   ├── use-links.ts         # Fetch links query
│   ├── use-link-mutations.ts # Create/edit/delete mutations
│   └── use-mobile.tsx       # Mobile breakpoint detection
├── lib/                     # Utilities & constants
│   ├── db.ts               # Database operations (Supabase)
│   ├── schemas.ts          # Zod validation schemas
│   ├── types.ts            # TypeScript types (COUNTRIES)
│   ├── query-keys.ts       # React Query key factory
│   └── utils.ts            # General utilities (cn, etc)
├── integrations/           # External service clients
│   └── supabase/
│       ├── client.ts       # Supabase JS client singleton
│       └── types.ts        # Supabase auto-generated types
├── test/                   # Unit & integration tests
│   ├── schemas.test.ts     # Zod schema validation (17 tests)
│   ├── db-utils.test.ts    # Database functions (7 tests)
│   ├── auth-context.test.tsx # Auth context state (8 tests)
│   ├── example.test.ts     # Example test
│   └── setup.ts            # Vitest config
├── App.tsx                 # Root component + routing
├── main.tsx                # Entry point
├── App.css                 # Global styles
└── index.css              # Tailwind + base CSS
```

---

## Naming Conventions

### TypeScript/React Files
- **Kebab-case for files** in lib/, hooks/, integrations/
  - `use-links.ts`, `use-link-mutations.ts`, `query-keys.ts`
- **PascalCase for React components** (pages, components)
  - `LinkCard.tsx`, `CreateLinkDialog.tsx`, `Auth.tsx`
- **Kebab-case for tests**
  - `schemas.test.ts`, `db-utils.test.ts`, `auth-context.test.tsx`

### TypeScript Variables & Functions
- **camelCase for functions, variables, hooks**
  ```typescript
  const generateShortCode = async () => { ... }
  const fetchLinks = async () => { ... }
  const useAuth = () => { ... }
  const createLinkInDB = async (name, defaultUrl) => { ... }
  ```
- **UPPERCASE for constants**
  ```typescript
  const COUNTRIES = [...]
  const BOT_PATTERN = /bot|crawler|.../i
  const API_TIMEOUT = 5000
  ```
- **PascalCase for types, interfaces, schemas**
  ```typescript
  interface AuthContextType { ... }
  type QRLinkRow = { ... }
  const linkFormSchema = z.object({ ... })
  ```

### Supabase Database
- **snake_case for tables, columns**
  - Tables: `qr_links`, `geo_routes`, `click_events`
  - Columns: `short_code`, `default_url`, `country_code`, `user_id`, `created_at`

### React Query
- **Centralized query key factory**
  ```typescript
  links: ["links"],
  link: (id) => ["links", id],
  analytics: {
    all: ["links", "analytics"],
    summaries: (linkIds) => ["links", "analytics", "summaries", ...linkIds],
    detail: (id) => ["links", "analytics", "detail", id],
  },
  ```

---

## React Patterns

### Hooks Usage

**Custom Hooks** (`use-*.ts`):
```typescript
// hooks/use-links.ts
export function useLinks() {
  return useQuery({
    queryKey: QUERY_KEYS.links,
    queryFn: fetchLinks,
    staleTime: 30_000,
  });
}

// hooks/use-link-mutations.ts
export function useLinkMutations() {
  const queryClient = useQueryClient();
  return {
    createLink: useMutation({ ... }),
    updateLink: useMutation({ ... }),
    deleteLink: useMutation({ ... }),
  };
}
```

**Using in Components**:
```typescript
const { data: links, isPending } = useLinks();
const { createLink } = useLinkMutations();

await createLink.mutateAsync(formData);
```

### Context Pattern (Auth)

**Provider Structure**:
```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize from storage, always resolve loading
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {}) // Supabase unreachable
      .finally(() => setLoading(false));

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

### Protected Routes

```typescript
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null; // Wait for auth resolution
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
```

### Form Pattern (react-hook-form + zod)

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { linkFormSchema, type LinkFormInput } from "@/lib/schemas";

function CreateLinkDialog() {
  const form = useForm<LinkFormInput>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: { name: "", defaultUrl: "", geoRoutes: [] },
  });

  const { createLink } = useLinkMutations();

  const onSubmit = async (data: LinkFormInput) => {
    try {
      await createLink.mutateAsync(data);
      form.reset();
    } catch (error) {
      toast.error("Failed to create link");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>Link Name</FormLabel>
          <FormControl>
            <Input {...field} placeholder="My Link" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      {/* More fields... */}
      <Button type="submit">Create</Button>
    </form>
  );
}
```

---

## Validation Patterns

### Short Code Format Contract

**Auto-generated**: `^[A-Z0-9]{6}$` (6 uppercase alphanumeric)
**Custom (if provided)**: `^[A-Z0-9_-]{3,20}$` (3-20 chars: uppercase, digits, underscore, hyphen)

**Enforcement**:
1. **Frontend**: Zod schema in `linkFormSchema` validates customShortCode format
2. **Backend (db.ts)**: Regex validation in `createLinkInDB()` before INSERT
3. **Database**: UNIQUE constraint on short_code, collision detect via try-catch
4. **Edge function**: Validates short code format before lookup

**Error Handling**:
- Invalid custom code format → `INVALID_SHORT_CODE_FORMAT` error (Vietnamese: "Mã code không hợp lệ")
- Collision on INSERT → catch error, suggest retry or auto-generate

### Zod Schemas (lib/schemas.ts)

All schemas are centralized in `lib/schemas.ts` with Vietnamese error messages:

```typescript
import { z } from "zod";

// Single geo route
export const geoRouteSchema = z.object({
  country: z.string(),
  countryCode: z.string().min(2, "Chọn quốc gia"),
  targetUrl: z.string().url("URL không hợp lệ"),
  bypassUrl: z.union([
    z.string().url("Bypass URL không hợp lệ"),
    z.literal(""),
  ]).optional(),
});

// Link form (create/edit) — supports auto or custom short code
export const linkFormSchema = z.object({
  name: z.string().min(1, "Tên không được để trống").max(100, "Tên quá dài"),
  defaultUrl: z.string().url("URL mặc định không hợp lệ"),
  customShortCode: z.union([
    z.string().regex(/^[A-Z0-9_-]{3,20}$/, "Mã code không hợp lệ"),
    z.literal(""),
  ]).optional(), // Empty string = auto-generate
  geoRoutes: z.array(geoRouteSchema).default([]),
});

// Auth form
export const authSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

// Type exports
export type GeoRouteInput = z.infer<typeof geoRouteSchema>;
export type LinkFormInput = z.infer<typeof linkFormSchema>;
export type AuthInput = z.infer<typeof authSchema>;
```

**Usage in Forms**:
```typescript
const form = useForm<LinkFormInput>({
  resolver: zodResolver(linkFormSchema),
  defaultValues: { geoRoutes: [] },
});
```

---

## Database Patterns

### Supabase Client (integrations/supabase/client.ts)

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
```

### Database Operations (lib/db.ts)

**Fetch with Relations**:
```typescript
export async function fetchLinks(): Promise<QRLinkRow[]> {
  const { data, error } = await supabase
    .from("qr_links")
    .select("*, geo_routes(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as QRLinkRow[]) || [];
}
```

**Insert with Error Handling & Short Code Validation**:
```typescript
export async function createLinkInDB(
  name: string,
  defaultUrl: string,
  geoRoutes: GeoRouteInput[],
  userId: string,
  customShortCode?: string
): Promise<QRLinkRow> {
  // Validate custom short code format
  if (customShortCode) {
    const customCodeRegex = /^[A-Z0-9_-]{3,20}$/;
    if (!customCodeRegex.test(customShortCode)) {
      throw new Error("INVALID_SHORT_CODE_FORMAT");
    }
  }

  const shortCode = customShortCode || await generateShortCode(); // Auto-gen: ^[A-Z0-9]{6}$

  const { data: link, error } = await supabase
    .from("qr_links")
    .insert({ name, short_code: shortCode, default_url: defaultUrl, user_id: userId })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { // Unique constraint violation
      throw new Error("DUPLICATE_SHORT_CODE");
    }
    throw error;
  }
  if (!link) throw new Error("Failed to create link");

  // Insert geo routes with error handling
  if (geoRoutes.length > 0) {
    const routes = geoRoutes
      .filter((r) => r.countryCode && r.targetUrl)
      .map((r) => ({
        link_id: link.id,
        country: r.country,
        country_code: r.countryCode,
        target_url: r.targetUrl,
        bypass_url: r.bypassUrl || null,
      }));

    if (routes.length > 0) {
      const { error: routeError } = await supabase.from("geo_routes").insert(routes);
      if (routeError) throw routeError;
    }
  }

  return { ...link, geo_routes: [] } as QRLinkRow;
}
```

**RPC Calls (Atomic Operations)**:
```typescript
export async function updateGeoRoutesInDB(
  linkId: string,
  geoRoutes: GeoRouteInput[]
) {
  const { error } = await supabase.rpc("upsert_geo_routes", {
    p_link_id: linkId,
    p_routes: geoRoutes.map((r) => ({
      country: r.country,
      country_code: r.countryCode,
      target_url: r.targetUrl,
      bypass_url: r.bypassUrl || "",
    })),
  });
  if (error) throw error;
}
```

---

## Testing Patterns

### Vitest Setup (test/setup.ts)

```typescript
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

afterEach(() => cleanup());
```

### Schema Testing (test/schemas.test.ts)

```typescript
import { describe, it, expect } from "vitest";
import { linkFormSchema, authSchema } from "@/lib/schemas";

describe("linkFormSchema", () => {
  it("validates a valid link form", () => {
    const data = {
      name: "My Link",
      defaultUrl: "https://example.com",
      geoRoutes: [],
    };
    expect(() => linkFormSchema.parse(data)).not.toThrow();
  });

  it("rejects invalid URL", () => {
    const data = {
      name: "My Link",
      defaultUrl: "not-a-url",
      geoRoutes: [],
    };
    expect(() => linkFormSchema.parse(data)).toThrow();
  });
});
```

### Auth Context Testing (test/auth-context.test.tsx)

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

describe("AuthProvider", () => {
  it("initializes with loading=true, then false", async () => {
    function TestComponent() {
      const { loading } = useAuth();
      return <div>{loading ? "Loading" : "Ready"}</div>;
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText("Loading")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });
  });
});
```

---

## Error Handling

### Try-Catch in Mutations (with Short Code Error Handling)

```typescript
async function handleCreateLink(data: LinkFormInput) {
  try {
    await createLink.mutateAsync(data);
    toast.success("Link created successfully");
    form.reset();
  } catch (error) {
    if (error.message === "INVALID_SHORT_CODE_FORMAT") {
      toast.error("Mã code không hợp lệ (3-20 ký tự: A-Z, 0-9, _, -)");
      form.setError("customShortCode", { message: "Định dạng mã không đúng" });
    } else if (error.message === "DUPLICATE_SHORT_CODE") {
      toast.error("Mã code đã tồn tại, vui lòng chọn mã khác");
      form.setError("customShortCode", { message: "Mã code đã được sử dụng" });
    } else {
      toast.error(`Failed to create link: ${error.message}`);
    }
  }
}
```

### Supabase Error Handling

```typescript
export async function fetchLinks(): Promise<QRLinkRow[]> {
  const { data, error } = await supabase
    .from("qr_links")
    .select("*, geo_routes(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch links:", error);
    throw error;
  }
  return (data as QRLinkRow[]) || [];
}
```

### Auth Context Always Resolves Loading

```typescript
useEffect(() => {
  supabase.auth.getSession()
    .then(...)
    .catch(() => {}) // Silently handle errors
    .finally(() => setLoading(false)); // Always resolve, even on error
}, []);
```

---

## UI Component Patterns

### shadcn/ui with Form Integration

```typescript
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLinkDialog({ open, onOpenChange }: CreateLinkDialogProps) {
  const form = useForm<LinkFormInput>({ ... });
  const { createLink } = useLinkMutations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create QR Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={createLink.isPending}>
            {createLink.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Loading States

```typescript
// Use React Query loading state
const { data: links, isPending, isError } = useLinks();

if (isPending) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

if (isError) {
  return <Alert variant="destructive">Failed to load links</Alert>;
}

return <div>{/* links content */}</div>;
```

---

## Theme & Styling

### Tailwind + next-themes

```typescript
// App.tsx
<ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
  {/* App content */}
</ThemeProvider>

// Component usage
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </Button>
  );
}
```

### Utility Classes (lib/utils.ts)

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn("px-4 py-2", isActive && "bg-blue-500")} />
```

---

## Environment Variables

### Required (frontend)
```
VITE_SUPABASE_URL=https://ybxmpuirarncxmenprzf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

### Example (.env.example)
```
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[key]
```

---

## Code Quality Guidelines

### Must-Have
- TypeScript strict mode enabled
- All Zod schemas centralized
- Forms use react-hook-form + zod
- Error handling in all async operations
- Auth context always resolves loading state
- RLS policies enforced on database

### Best Practices
- Use React Query for server state
- Custom hooks for reusable logic
- Centralized constants (COUNTRIES, BOT_PATTERN)
- Proper error messages (Vietnamese)
- Loading skeletons instead of spinners
- No non-null assertions (except justified cases)

### Known Issues to Fix
1. Add component test coverage for business components (StatsPanel, LinkCard, dialogs, QRPreview)
2. Add automated coverage for redirect edge paths (proxy-gateway already has smoke tests)
3. Add cached rollups or materialized summaries for higher-volume and longer-range analytics
4. Split the main production bundle to reduce the Vite chunk-size warning

---

## Build & Deploy

### Development
```bash
npm install
npm run dev       # Vite dev server with HMR
npm run typecheck # TypeScript check
npm run lint      # ESLint
```

### Testing
```bash
npm run test      # Run all tests
npm run gateway:test # Run proxy-gateway smoke tests
npm run test:watch # Watch mode
```

### Production
```bash
npm run build     # Build for production (vite build)
npm run preview   # Preview production build locally
```

**Deployment**:
- Frontend: Vercel (auto-deploy from GitHub)
- Backend: Supabase (manual edge function deploy)
- Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
