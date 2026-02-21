import { WorkspaceProvider } from '@/lib/workspace-context';
import { TabProvider } from '@/lib/tab-context';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <TabProvider>
        {children}
      </TabProvider>
    </WorkspaceProvider>
  );
}
