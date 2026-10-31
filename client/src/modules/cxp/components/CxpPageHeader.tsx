import type { ReactNode } from 'react';
import { CxpBreadcrumb } from './CxpBreadcrumb';

export function CxpPageHeader({ title, description, group, actions }: {
  title: string; description: string; group: string; actions?: ReactNode;
}) {
  return <header className="cxp-workspace-header">
    <div className="cxp-workspace-heading"><CxpBreadcrumb group={group} />
      <h1>{title}</h1><p>{description}</p>
    </div>
    {actions && <div className="cxp-workspace-context">{actions}</div>}
  </header>;
}
