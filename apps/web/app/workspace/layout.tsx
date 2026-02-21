import { WorkspaceProvider } from '@/lib/workspace-context';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      {children}
    </WorkspaceProvider>
  );
}
