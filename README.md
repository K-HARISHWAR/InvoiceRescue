# InvoiceRescue AI

**Stop chasing invoices. Start getting paid.**

InvoiceRescue AI is an AI-powered accounts receivable intelligence system designed for small businesses. It monitors your invoices, understands customer communication, detects payment promises, calculates payment risk deterministically, recommends collections actions, and automatically prepares structured legal evidence when payments become difficult to recover.

---

## 🌟 Key Features

* **AI Invoice Extraction:** Instantly extract structured data from uploaded PDFs or image invoices.
* **Receivables Dashboard:** Gain real-time visibility into your cash flow, overdue balances, and at-risk invoices.
* **Payment-Risk Engine:** A deterministic scoring algorithm that evaluates customer behaviour and payment delays.
* **Payment-Promise Detection:** AI automatically reads emails to detect and track when customers promise to pay.
* **Contextual Collection Drafts:** AI drafts professional follow-up emails based on exactly how late the customer is.
* **Gmail Intelligence:** Securely syncs and associates customer correspondence directly to the relevant invoice timeline.
* **Recovery Evidence Packs:** Generates a complete chronological dossier of an invoice's history for legal or collection agency handoff.

---

## 🏗️ Architecture

The application is built on a highly secure, serverless stack.

```
React (Vite + TypeScript)
  ↓
Supabase Auth
  ↓
PostgreSQL + Row Level Security (RLS)
  ↓
Supabase Private Storage
  ↓
Supabase Edge Functions (Deno)
  ↓
Gemini AI / Gmail API
```

---

## 🚀 Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-org/invoicerescue.git
cd invoicerescue
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Note:** Never expose your Supabase Service Role Key or AI API keys in this file. They belong strictly in Edge Function secrets.

---

## 🗄️ Supabase Setup

### 1. Push Database Migrations
Deploy the database schema, RLS policies, and SQL functions to your Supabase instance:
```bash
npx supabase db push
```

### 2. Set Edge Function Secrets
Ensure your edge functions have the credentials they need:
```bash
npx supabase secrets set AI_PROVIDER=gemini
npx supabase secrets set AI_API_KEY=your-gemini-api-key
npx supabase secrets set AI_MODEL=gemini-1.5-pro
```

### 3. Deploy Edge Functions
```bash
npx supabase functions deploy
```

---

## 📧 Google OAuth Setup (Gmail Sync)

To enable automatic email syncing and sending:
1. Create a Google Cloud Project.
2. Enable the **Gmail API**.
3. Configure your OAuth consent screen.
4. Create an OAuth Web Client credential.
5. Add your edge function URL to the Authorized Redirect URIs.
6. Set the Google secrets in Supabase:
   ```bash
   npx supabase secrets set GOOGLE_CLIENT_ID=your-client-id
   npx supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
   npx supabase secrets set GOOGLE_REDIRECT_URI=your-redirect-uri
   npx supabase secrets set TOKEN_ENCRYPTION_KEY=a-32-byte-secure-key
   ```

---

## 🔒 Security Architecture

InvoiceRescue handles highly sensitive financial data and is engineered for strict multi-tenant security:
- **Row Level Security (RLS):** Every single database read/write is strictly scoped via `is_business_member` checks. A user in Business A can never access data belonging to Business B.
- **Private Storage:** Invoice documents and Recovery Packs are stored in completely private buckets, accessible only via signed short-lived URLs authenticated by RLS.
- **Server-Side Secrets:** All AI and OAuth API keys live exclusively within Supabase Edge Functions. The React frontend never sees them.
- **Deterministic Finances:** Risk scores and outstanding balances are calculated entirely by strict PostgreSQL triggers, never by hallucination-prone LLMs.

---

## 🌐 Production Deployment (Vercel)

Deploying the frontend to Vercel is seamless:

1. Push your code to GitHub.
2. Log into Vercel and click **Add New Project**.
3. Import your GitHub repository.
4. Set the **Framework Preset** to `Vite`.
5. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**.

*(Don't forget to add your new Vercel domain to your Supabase Auth allowed Redirect URLs!)*

---

## 🎥 Demo Workflow (For Judges)

The application has been seeded with a specific Hackathon Scenario to demonstrate its full capabilities. Follow these steps:

1. **Sign Up & Onboard:** Create an account and create a business workspace.
2. **Review Dashboard:** You will see your real-time outstanding balance and risk exposure.
3. **Upload an Invoice:** Click "Upload Invoice" and submit a PDF. Watch the AI instantly extract the data.
4. **Follow the Timeline (ABC Enterprises):**
   - Navigate to the **ABC Enterprises** invoice `INV-1043`.
   - Observe that the **Due date is monitored** and the invoice is overdue.
   - A **Friendly Reminder** was sent on Sep 11.
   - The AI **imported an email** and detected a **Payment Promise** for Sep 18.
   - The promise date passed without payment, triggering the engine to mark the promise **missed** and significantly **increase the risk score**.
   - A second promise for Sep 25 was tracked and also missed.
   - The collection action engine **escalated** the communication.
   - The invoice is now classified as **Critical Risk**.
5. **Generate Recovery Pack:** Click **Generate Recovery Pack** to instantly assemble a comprehensive, downloadable zip dossier containing the original invoice, proof of delivery, and the complete chronological timeline of every missed promise and sent email.
