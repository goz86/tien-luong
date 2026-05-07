import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useAuthSync } from './hooks/useAuthSync';
import { useDataSync } from './hooks/useDataSync';
import { useSyncQueriesToStore } from './hooks/useQueries';
import AppLayout from './components/AppLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppInner() {
  useOnlineStatus();
  useAuthSync();
  useDataSync();
  useSyncQueriesToStore();
  return <AppLayout />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
