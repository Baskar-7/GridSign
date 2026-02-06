# Project Context: GridSign

GridSign is a digital signing platform built internally, similar to DocuSign.

## Current Setup
- Folder Structure:

/gridsign
├── /backend --> ASP.NET Core Web API
└── /frontend --> Next.js (App Router, TypeScript)


## Frontend Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **UI Framework:** Tailwind CSS + ShadCN UI
- **Form Handling:** react-hook-form + zod
- **State Management:** Context API (and local state where needed)
- **Animations:** framer-motion
- **Icons:** lucide-react
- **API Integration:** Axios calling .NET Web API at http://localhost:5000/api
- **Auth:** JWT stored in httpOnly cookies

## Current UI Progress
✅ Login & Signup Pages  
✅ Sidebar Layout with Navigation  
✅ Dashboard Page (partially complete)  
✅ Workflow List Page (basic table view)

## Pending Work
- Improve Dashboard stats cards with live data
- Add Create Workflow form + document upload modal
- Build Recipient management page
- Integrate all API endpoints with backend
- Add toast notifications & error handling
- Polish responsive behavior & transitions

## Goal for Copilot
From now on, I’ll use Copilot to:
- Extend existing components (not rewrite everything)
- Suggest new pages, modals, and hooks consistent with current code
- Keep styling consistent with ShadCN UI
- Ensure reusable code with modular components
