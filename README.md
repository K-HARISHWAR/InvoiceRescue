# InvoiceRescue AI

InvoiceRescue AI is a professional, multi-organisation SaaS platform designed to help small businesses, finance teams, and accounting departments automate and manage their accounts receivable process.

By combining deterministic financial rules with smart AI-driven automation, InvoiceRescue eliminates the manual overhead of collections, tracks payment behaviour, and significantly reduces Days Sales Outstanding (DSO).

## Core Features

- **Multi-Organisation & Entity Support:** Manage multiple workspaces and legal entities with separate currencies, branding, and collection policies—all from a single login.
- **AI-Powered Invoice Extraction:** Simply drag and drop invoice documents (PDF, JPG, PNG). InvoiceRescue uses AI to automatically extract line items, totals, dates, and customer details. (You always remain in control and review the data before saving).
- **Automated Collection Engine:** Configure powerful, entity-specific reminder workflows. InvoiceRescue automatically syncs with Gmail, sending out friendly reminders, due-date notices, and overdue escalations based on your custom schedules.
- **Smart Communication Analysis:** Through Gmail integration, InvoiceRescue securely reads inbound customer replies. The AI automatically classifies them into categories (e.g., payment promises, disputes, document requests) and flags high-risk communication.
- **Robust Security & RBAC:** Built on Supabase, the platform uses strict Row-Level Security (RLS) and a granular Role-Based Access Control (RBAC) system (Owner, Admin, Finance Manager, Collections Agent, Viewer).
- **Financial Integrity:** Invoices have strict state machines. Overpayments, negative payments, and duplicate invoices are blocked at the database level. History is fully auditable.

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Router, Recharts.
- **Backend:** Supabase (PostgreSQL, Row-Level Security, Edge Functions, Storage).
- **AI Engine:** Google Gemini (via Supabase Edge Functions).
- **Email:** Google Workspace (OAuth2, Gmail API).
- **Testing:** pgTAP (Database), Vitest (Frontend Date/Logic).

## Getting Started

### Prerequisites

1. Node.js (v18+)
2. npm or pnpm
3. A Supabase Project
4. A Google Cloud Console project (for Gmail API credentials)
5. A Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/K-HARISHWAR/InvoiceRescue.git
   cd InvoiceRescue
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Copy `.env.example` to `.env` and fill in your Supabase credentials.

4. Run the development server:
   ```bash
   npm run dev
   ```

### Supabase Setup

1. Link your project:
   ```bash
   npx supabase link --project-ref your-project-ref
   ```

2. Push the database schema and RLS policies:
   ```bash
   npx supabase db push
   ```

3. Deploy the Edge Functions:
   Ensure you have set the necessary secrets (`AI_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`) in your Supabase project dashboard, then deploy:
   ```bash
   npx supabase functions deploy
   ```

## Architecture Notes

- **Never Trust the Client:** All financial mutations and permissions are enforced via Postgres Row-Level Security (RLS) and database triggers.
- **Deterministic AI:** AI is used for reading documents and classifying text, but *never* for calculating financial balances or performing irreversible legal actions.

---
*Built as a production-grade upgrade of the original InvoiceRescue Hackathon project.*
