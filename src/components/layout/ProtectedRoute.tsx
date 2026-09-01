import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';

export default function ProtectedRoute() {
  const { user, business, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 bg-blue-600 rounded-full mb-4"></div>
          <div className="text-sm text-neutral-500 font-medium">Loading workspace...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!business && location.pathname !== '/onboarding' && location.pathname !== '/app/invite') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
