import { AuthGuard } from '@/lib/auth-guard';
import { WorkspaceProvider } from '@/lib/workspace-context';
import { TabProvider } from '@/lib/tab-context';
import { SpreadsheetDataProvider } from '@/lib/spreadsheet-data-store';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <WorkspaceProvider>
        <TabProvider>
          <SpreadsheetDataProvider>
            {children}
          </SpreadsheetDataProvider>
        </TabProvider>
      </WorkspaceProvider>
    </AuthGuard>
  );
}
