import Cashier from './Cashier'
import EcosystemContextBridge from '@/components/ecosystem/EcosystemContextBridge'
import EcosystemCaseFlow from '@/components/ecosystem/EcosystemCaseFlow'
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext'

/**
 * Finance is a first-class ecosystem surface. The existing Cashier remains
 * the operational ledger UI; this adapter makes clinical context explicit
 * without duplicating payment logic or inventing a second finance module.
 */
export default function EcosystemFinanceWorkspace() {
  const context = useEcosystemUrlContext()
  const hasContext = Boolean(
    context.patientId || context.caseId || context.branchId || context.organizationId,
  )

  return (
    <>
      {hasContext && <EcosystemContextBridge {...context} />}
      {(context.patientId || context.caseId) && (
        <div className="px-4 pt-4 sm:px-6">
          <EcosystemCaseFlow context={context} compact />
        </div>
      )}
      <Cashier />
    </>
  )
}
