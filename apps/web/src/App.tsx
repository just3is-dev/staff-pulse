import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/api/query-client';
import { OrgTreeScreen } from '@/components/OrgTreeScreen/OrgTreeScreen';

function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <OrgTreeScreen />
    </QueryClientProvider>
  );
}

export default App;
