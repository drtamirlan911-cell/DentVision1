import React from 'react';
import { BrainCircuit, ClipboardList, FlaskConical, Package, WalletCards } from 'lucide-react';
import EcosystemRelationRail from './EcosystemRelationRail';
import EcosystemActionLauncher from './EcosystemActionLauncher';
import EcosystemContextBridge from './EcosystemContextBridge';

interface Props { patientId?: string; caseId?: string; branchId?: string; organizationId?: string; patientName?: string; diagnosis?: string; className?: string }

export default function EcosystemClinicalRail({ patientId, caseId, branchId, organizationId, patientName, diagnosis, className }: Props) {
  return <div className={className}>
    <EcosystemContextBridge patientId={patientId} caseId={caseId} branchId={branchId} organizationId={organizationId} />
    <div className="mt-3 rounded-2xl border border-bdr-subtle bg-surface-1 p-3">
      <div className="flex items-start gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-dv-gold/10 text-dv-gold"><BrainCircuit size={15} /></span><div><div className="text-xs font-semibold text-txt-primary">Clinical Case</div><div className="text-[10px] text-txt-muted">{patientName || 'Пациент'}{diagnosis ? ` · ${diagnosis}` : ''}</div></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <EcosystemActionLauncher actionId="review-diagnostic-result" showDescription={false} />
        <EcosystemActionLauncher actionId="create-lab-order" showDescription={false} />
        <EcosystemActionLauncher actionId="find-material" showDescription={false} />
        <EcosystemActionLauncher actionId="review-finance" showDescription={false} />
      </div>
    </div>
    <div className="mt-3"><EcosystemRelationRail node="clinical-case" /></div>
  </div>;
}
