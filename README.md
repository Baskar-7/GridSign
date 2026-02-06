# GridSign

A full-stack electronic document workflow and signing platform. GridSign enables template-driven workflows, recipient management, secure single-use signing tokens, profile & email verification flows, reminders, and PDF field stamping—built with a modern React/Next.js frontend and a robust ASP.NET Core backend.

## Overview
GridSign provides:
- **Template & Workflow Management**: Create reusable templates and initiate workflows with multiple view modes (Grid, Kanban, Grouped, Table, Hybrid, Activity, Analytics)
- **Recipient Management**: Role assignment, field mapping, and sequential/parallel signing modes
- **Secure Token System**: Single-use signing tokens with email delivery and automatic expiration
- **Email Verification**: Staged pending email system with resend capability
- **Profile Management**: Avatar upload, company metadata, timezone awareness, theme preferences
- **Advanced Reporting**: Interactive dashboards with charts, KPIs, and export functionality
- **Automated Reminders**: Quartz-based background jobs for outstanding signing tasks
- **Modern UI**: Clean, professional design with dark mode, multiple view modes, and responsive layouts
- **PDF Manipulation**: Client-side PDF field stamping and document generation using pdf-lib

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

### Workflow Management
- **7 View Modes**: Grid, Grouped, Kanban, DataTable, Hybrid, Activity, Analytics
- **Advanced Filtering**: Multi-status filters, search, date range, creator filters
- **Smart Sorting**: Sort by name, date, status, creator with ascending/descending
- **Pagination**: Configurable page sizes (10, 25, 50, 100 items)
- **Lifecycle Management**: Start, cancel, view, delete workflows with confirmation dialogs
- **Status Tracking**: Completed, In-Progress, Draft, Expired, Cancelled, Failed
- **Card-Based Grouped View**: Clean card layout matching template design
- **Kanban Board**: Drag-and-drop status management with column organization

### Template Management
- **Multiple View Modes**: Grid, Grouped, Kanban, DataTable, Hybrid, Activity, Analytics
- **Template Grid**: Clean card design with status badges and hover effects
- **Usage Tracking**: Monitor template usage counts and analytics
- **Draft Management**: Create, edit, and delete draft templates
- **Template Details**: Comprehensive template configuration and field mapping
- **Kanban View**: Workflow-style kanban board for template organization

### Reports & Analytics
- **Interactive Dashboard**: Real-time metrics and visualizations
- **KPI Cards**: Total workflows, documents signed, completion time, active users
- **Advanced Charts**: Area, Bar, Donut, Radial gauge, Stacked bar charts
- **Data Export**: CSV export functionality with date range selection
- **Status Distribution**: Visual breakdown of workflow statuses
- **Recent Activity**: Timeline view of workflow events
- **Top Users**: Leaderboard of most active users
- **Chart Customization**: Labels hidden on bars, hover tooltips for full information
- **Responsive Design**: Mobile-optimized chart layouts

### Security & Authentication
- **Single-Use Tokens**: Prevent replay attacks on signing requests
- **JWT Authentication**: Secure bearer token system
- **Role-Based Access**: Admin, User, Signer roles with policy enforcement
- **Email Verification**: Staged pending email system before activation
- **Token Expiration**: Automatic cleanup of expired/used tokens
- **CORS Protection**: Restricted to known origins

### User Experience
- **Dark Mode Support**: Automatic theme detection and manual toggle
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **Local Preferences**: Persisted filters, view modes, and UI state
- **Smooth Animations**: Micro-interactions and transitions throughout
- **Accessible UI**: ARIA labels, keyboard navigation, screen reader support
- **Professional Design**: Clean, minimal color palette with strategic accents

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
- **Next.js 15** (Turbopack dev/build, App Router)
- **React 19** + TypeScript 5
- **TanStack Query 5** for data caching, mutations & optimistic updates
- **Tailwind CSS 4** (utility styling) + Radix UI primitives
- **Recharts** for advanced data visualizations
- **Vitest + Testing Library** (React + jsdom) for fast test runs
- **Lucide Icons** for comprehensive icon set
- **pdf-lib** for client-side PDF manipulation
- **Sonner** for toast notifications
- **Local Storage** for preference persistence (theme, filters, view modes)

### Frontend Features
- **Component Architecture**: Modular, reusable components with TypeScript
- **State Management**: Local state + TanStack Query for server state
- **Form Handling**: Controlled components with validation
- **Error Boundaries**: Graceful error handling and recovery
- **Loading States**: Skeleton screens and loading indicators
- **Optimistic Updates**: Instant UI feedback before server confirmation
- **Responsive Tables**: Adaptive layouts for mobile and desktop
- **Chart Library**: Custom SVG charts + Recharts for advanced visualizations

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
- [x] Multiple view modes for workflows and templates (Grid, Kanban, Grouped, etc.)
- [x] Advanced filtering and sorting capabilities
- [x] Card-based grouped view matching template design
- [x] Kanban board with workflow-style design for templates
- [x] Enhanced reports dashboard with interactive charts
- [x] Chart optimizations (hidden labels, hover tooltips)
- [ ] Implement token cleanup background job (purge expired/used SigningTokens)
- [ ] Harden email templates (responsive + dark mode)
- [ ] Add integration/API tests for signing completion & token invalidation
- [ ] Introduce rate limiting on verification email resends
- [ ] Real-time notifications for workflow updates
- [ ] Bulk workflow operations (start, cancel, delete multiple)
- [ ] Advanced analytics with custom date ranges and filters
- [ ] Template versioning and history tracking
- [ ] Add license file (currently unspecified)

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
