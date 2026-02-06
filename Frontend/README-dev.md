# GridSign Frontend Developer Notes

## Folder Structure
/frontend
├── /app
│ ├── layout.tsx
│ ├── page.tsx
│ ├── dashboard/
│ ├── workflows/
│ ├── recipients/
│ └── settings/
├── /components
│ ├── ui/
│ ├── dashboard/
│ ├── workflows/
│ └── common/
├── /hooks
├── /lib
└── /types

## Guidelines for Copilot
- Use functional components.
- Prefer ShadCN UI + Tailwind.
- Reuse existing components and layouts.
- Keep components modular and consistent.c

## Workflow Details Debug Notes

To ensure recipients and envelopes load on the workflow details page:

1. Set NEXT_PUBLIC_LOCAL_API_URL to point to the backend API base including /api. Example:
	export NEXT_PUBLIC_LOCAL_API_URL="http://localhost:5035/api"
2. Sign in so a valid JWT token is saved to localStorage under 'token'. The details endpoint returns 401 without it.
3. Navigate to /workflow/wf-{id} where {id} is an existing workflow that has recipients/envelopes.
4. If you recently changed serialization to camelCase, hard refresh (Shift+Reload) to clear cached PascalCase payloads.
5. The page uses embedded progress metrics inside the details DTO; a secondary progress request is still made but can be removed later.

Troubleshooting:
- 401 Unauthorized: Token missing or expired; re-authenticate.
- Empty recipients/envelopes arrays: Confirm the workflow in DB actually has related recipient/envelope rows.
- Wrong base URL (requests hitting Next.js dev server): Verify NEXT_PUBLIC_LOCAL_API_URL includes protocol, host, port, and ends with /api.
- Stale data after backend restart: Use the Refresh button or clear React Query cache (browser hard reload).
