import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import AppLayout from '@/components/layout/AppLayout'

// Auth & Public
import Login from '@/features/auth/Login'
import Signup from '@/features/auth/Signup'
import Onboarding from '@/features/onboarding/Onboarding'

// Protected Dashboard
import Dashboard from '@/features/dashboard/Dashboard'
import InvoiceList from '@/features/invoices/InvoiceList'
import InvoiceDetail from '@/features/invoices/InvoiceDetail'
import CustomerList from '@/features/customers/CustomerList'
import CustomerDetail from '@/features/customers/CustomerDetail'
import ActionCenter from '@/features/collections/ActionCenter'
import Recovery from '@/features/recovery/Recovery'
import Settings from '@/features/settings/Settings'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="invoices/:invoiceId" element={<InvoiceDetail />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:customerId" element={<CustomerDetail />} />
            <Route path="actions" element={<ActionCenter />} />
            <Route path="recovery" element={<Recovery />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}
