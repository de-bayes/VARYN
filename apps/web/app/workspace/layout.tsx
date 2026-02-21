import { AuthGuard } from '@/lib/auth-guard';
import { WorkspaceProvider } from '@/lib/workspace-context';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <WorkspaceProvider>
        {children}
      </WorkspaceProvider>
    </AuthGuard>
  );
}
