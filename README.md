# GridSign

A full-stack electronic document workflow and signing platform. GridSign enables template-driven workflows, recipient management, secure single-use signing tokens, profile & email verification flows, reminders, and PDF field stamping—built with a modern React/Next.js frontend and a robust ASP.NET Core backend.

## Overview
GridSign provides:
- Template creation and workflow initiation
- Recipient role assignment and field mapping
- Secure, single-use signing tokens delivered via email (and reused for reminders until consumed/expired)
- Email verification with pending email staging and resend capability
- Profile management with avatar upload, company & title metadata, timezone awareness
- Automated reminder jobs (Quartz) for outstanding signing tasks
- Local UI preferences (theme, filters, view modes) persisted in browser storage
- PDF manipulation on the client using `pdf-lib`

## Architecture
```
Root
├── Backend (ASP.NET Core 8, EF Core, MySQL, Quartz, Serilog, JWT)
│   ├── GridSign.sln / GridSign.csproj
│   ├── Data/ (DbContext, migrations)
│   ├── Models/Entities (Users, Verification, SigningToken, etc.)
│   ├── Repositories (View + Update repo pattern per aggregate)
│   ├── Services (SigningWorkflowService, TemplateService, ReportsService ...)
│   ├── BackgroundServices (Quartz jobs e.g. WorkflowReminderJob)
│   ├── Controllers (API endpoints)
│   ├── Configurations (JWT, external integrations)
│   └── Migrations (EF Core)
├── Frontend (Next.js 15 + React 19 + TypeScript + Tailwind + Radix UI + TanStack Query)
│   ├── app/ (Route segments, pages)
│   ├── components/ (Profilepage, AppShell, Signing components, etc.)
│   ├── hooks/ (useApiQuery, domain data hooks)
│   ├── lib/ (apiClient, signingToken utilities)
│   ├── types/ (Shared TypeScript interfaces)
│   ├── __tests__/ (Vitest unit/integration tests)
│   └── public/ (PDF workers)
└── Documentation (.md summaries: GET-STARTED, CLEAN-UI-SUMMARY, WORKFLOWS-OVERVIEW-SUMMARY, etc.)
```

## Key Features
- One-time signing token generation & validation (invalidated on first successful signing)
- Token reuse logic for reminders if still active
- Email verification workflow (PendingEmail + IsMailVerified)
- Avatar management with server-side persistence
- Robust repository-service layering for maintainability
- Automatic DB migration application at startup (with `Database.Migrate()`)
- Background Quartz job scheduling (reminders)
- Strongly typed front-end API layer + local preference storage
- Unit tests (Vitest + Testing Library) for token extraction & profile logic
- PDF field stamping via client-side libraries

## Backend Stack
- .NET 8 / ASP.NET Core Web API
- Entity Framework Core (Pomelo MySQL provider) + Migrations
- Quartz.NET for scheduled jobs (persistent MySQL store for job data)
- Serilog for structured logging (console + rolling file)
- JWT Bearer authentication & role-based authorization policies (`Admin`, `User`, `Signer`)
- AutoMapper for DTO/entity mapping
- Swagger/OpenAPI in Development for API exploration

### Notable Backend Concepts
| Concept | Notes |
|---------|-------|
| Users | Stores profile, verification, pending email state, avatar reference |
| Verification | Tracks email token for verification flow |
| SigningToken | Single-use or reusable (until used/expired) token linked to a workflow recipient |
| SigningWorkflowService | Orchestrates invitation, reminder, completion validation |
| Quartz Jobs | Reminder job triggers token reuse/invite logic |

## Frontend Stack
- Next.js 15 (Turbopack dev/build)
- React 19 + TypeScript 5
- TanStack Query 5 for data caching & re-fetching
- Tailwind CSS 4 (utility styling) + Radix UI primitives
- Vitest + Testing Library (React + jsdom) for fast test runs
- Lucide icons, pdf-lib for PDF manipulation
- Local preference persistence (theme, filters, view modes)

## Running Locally
### Prerequisites
- Node.js (LTS) & npm or pnpm
- .NET 8 SDK
- MySQL 8.x instance (or compatible) reachable with credentials

### 1. Clone Repository
```bash
git clone <repo-url>
cd Gridsign
```

### 2. Configure Backend
Update `appsettings.Development.json` (inside `Backend/GridSign/GridSign`) with connection strings:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Port=3306;Database=gridsign_db;User=root;Password=yourpw;",
    "QuartzDbConnection": "Server=localhost;Port=3306;Database=gridsign_quartz;User=root;Password=yourpw;"
  },
  "JwtSettings": {
    "Issuer": "GridSign",
    "Audience": "GridSignUsers",
    "Key": "YOUR_LONG_RANDOM_SECURE_KEY"
  }
}
```

### 3. Restore & Run Backend
```bash
cd Backend/GridSign/GridSign
dotnet restore
dotnet build
dotnet run
```
Backend will apply existing migrations at startup via `Database.Migrate()`.

### 4. Frontend Setup
```bash
cd Frontend/gridsign_nextjs
npm install
npm run dev
```
Visit: `http://localhost:3000`

## Database & Migrations
### Adding the Missing SigningToken Migration
If the `signingtokens` table does not yet exist:
```bash
cd Backend/GridSign/GridSign
# Generate migration
dotnet ef migrations add AddSigningToken --context ApplicationDbContext
# Apply to DB
dotnet ef database update
```
Confirm creation by inspecting MySQL schema.

### Automatic Application
The backend calls `dbContext.Database.Migrate()` on startup; ensure the correct connection string and permissions.

## Testing (Frontend)
Run unit tests:
```bash
cd Frontend/gridsign_nextjs
npm test
```
Vitest covers token utilities (`lib/signingToken.ts`) and profile email verification flows.

## Workflow: Secure Signing Token
1. Invitation email includes link: `/sign/{envelopeId}?recipientId=<id>&token=<guid>`.
2. Frontend page extracts token & recipientId, appends token to completion POST payload.
3. Backend validates token, marks as used, persists signed data.
4. Reminder emails reuse token if still valid; otherwise new token generated.

## Email Verification Flow
- Profile email edits set `PendingEmail` + reset `IsMailVerified=false`.
- Verification link (HTML email) finalizes transition from `PendingEmail` to `Email` once confirmed.
- Resend verification button triggers re-dispatch of link if still pending.

## Security Considerations
- Single-use tokens prevent replay signing requests.
- JWT token authentication for protected endpoints.
- Role policies limit access scope (`Admin`, `User`, `Signer`).
- Pending email staging prevents accidental email overwrite before verification.
- CORS restricted to known local dev origins.

## Logging & Observability
- Serilog writes to console & rolling file under `Logs/`.
- Warnings & EF diagnostics surfaced during build/migration.

## Roadmap / Next Steps
- [ ] Implement token cleanup background job (purge expired/used SigningTokens).
- [ ] Harden email templates (responsive + dark mode).
- [ ] Add integration/API tests for signing completion & token invalidation.
- [ ] Introduce rate limiting on verification email resends.
- [ ] Add license file (currently unspecified).

## Troubleshooting
| Issue | Possible Cause | Fix |
|-------|----------------|-----|
| `signingtokens` table missing | Migration not generated/applied | Run EF migration commands above |
| Email not updating after verify | Pending email flow incomplete | Confirm verification endpoint marks `IsMailVerified` & applies pending |
| Token validation fails | Token expired or already used | Request new signing reminder; check expiry logic |
| Avatar not refreshing | Cached URL reused | Increment `avatarVersion` or disable caching in request |

## Folder Structure (Condensed)
```
Backend/GridSign/GridSign/
  Controllers/
  Services/
  Repositories/
  Models/Entities/
  Data/ApplicationDbContext.cs
  Program.cs
Frontend/gridsign_nextjs/
  app/
  components/
  hooks/
  lib/
  types/
  __tests__/
```

## Contributing
1. Fork & create a feature branch.
2. Keep changes scoped & add/update tests.
3. Ensure EF migrations are included when altering entities.
4. Open PR with description & screenshots for UI changes.

## License
No license file yet. Add one (e.g. MIT) before public distribution.

---
**GridSign** – Streamlined, secure document workflow & signing.
