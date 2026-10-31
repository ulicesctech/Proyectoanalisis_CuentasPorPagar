import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CxpButton } from './CxpButton';

export function CxpBackToMenu() {
  const navigate = useNavigate();
  return <CxpButton variant="secondary" icon={ArrowLeft} onClick={() => navigate('/cxp')}>Volver a Cuentas por pagar</CxpButton>;
}
