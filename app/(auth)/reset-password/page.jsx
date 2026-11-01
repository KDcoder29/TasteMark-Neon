'use client'
import ResetPassword from '@/components/auth/ResetPassword'
import ClientOnly from '@/components/app/ClientOnly'
import ErrorBoundary from '@/components/app/ErrorBoundary'

// /reset-password?token=… from the reset email (minimal for now; Task 3c owns and refines this page)
export default function ResetPasswordPage() {
  return <ClientOnly><ErrorBoundary><ResetPassword /></ErrorBoundary></ClientOnly>
}
