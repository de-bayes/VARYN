import { AuthGuard } from '@/lib/auth-guard';
import { WorkspaceProvider } from '@/lib/workspace-context';
import { TabProvider } from '@/lib/tab-context';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <WorkspaceProvider>
        <TabProvider>
          {children}
        </TabProvider>
      </WorkspaceProvider>
    </AuthGuard>
  );
}
