import { CxpLayout } from '../CxpLayout';
import { ModuleHeader } from './ModuleHeader';
import { ModuleSection } from './ModuleSection';
import { CXP_HOME_HEADER, CXP_HOME_SECTIONS } from './cxpHome.config';

export function CxpHomePage() {
  return <CxpLayout>
    <div className="mx-auto max-w-7xl space-y-8">
      <ModuleHeader {...CXP_HOME_HEADER} />
      {CXP_HOME_SECTIONS.map(section => <ModuleSection key={section.id} {...section} />)}
    </div>
  </CxpLayout>;
}
