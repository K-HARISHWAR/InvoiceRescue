import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import { SessionProvider } from '@/contexts/SessionContext'

// Auth & Public
import Login from '@/features/auth/Login'
import Signup from '@/features/auth/Signup'
import ForgotPassword from '@/features/auth/ForgotPassword'
import ResetPassword from '@/features/auth/ResetPassword'
import Onboarding from '@/features/onboarding/Onboarding'

// Protected Dashboard
import Dashboard from '@/features/dashboard/Dashboard'
import InvoiceList from '@/features/invoices/InvoiceList'
import InvoiceDetail from '@/features/invoices/InvoiceDetail'
import InvoiceForm from '@/features/invoices/InvoiceForm'
import CustomerList from '@/features/customers/CustomerList'
import CustomerDetail from '@/features/customers/CustomerDetail'
import ActionCenter from '@/features/collections/ActionCenter'
import Recovery from '@/features/recovery/Recovery'
import Settings from '@/features/settings/Settings'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Onboarding is protected but doesn't require a business */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>

            {/* App is protected and requires a business */}
            <Route path="/app" element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="invoices" element={<InvoiceList />} />
                <Route path="invoices/new" element={<InvoiceForm />} />
                <Route path="invoices/:invoiceId" element={<InvoiceDetail />} />
                <Route path="customers" element={<CustomerList />} />
                <Route path="customers/:customerId" element={<CustomerDetail />} />
                <Route path="actions" element={<ActionCenter />} />
                <Route path="recovery" element={<Recovery />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </SessionProvider>
    </QueryClientProvider>
  )
}
