// Standalone technical preview for the Dental Geometry Engine — not part of
// the clinical odontogram flow yet (see docs/DENTAL_3D_ENGINE.md, Phase 3).
// Deliberately has no sidebar/app-chrome dependency so it can be reviewed
// in isolation, the same way /sign and /plan/:releaseId stand alone.
import { TOOTH_16 } from '@/dental3d/teeth/tooth16'
import { DentalViewer3D } from '@/dental3d/viewer/DentalViewer3D'

export default function Dental3DPreview() {
  return (
    <div className="min-h-screen bg-surface-0 text-txt-primary p-6">
      <div className="max-w-[960px] mx-auto">
        <h1 className="text-xl font-bold mb-1">Dental Geometry Engine — предпросмотр</h1>
        <p className="text-sm text-txt-muted mb-5">
          FDI {TOOTH_16.fdi} · {TOOTH_16.commonName} · master-модель, не часть клинической одонтограммы
        </p>
        <div style={{ height: 560 }}>
          <DentalViewer3D tooth={TOOTH_16} />
        </div>
      </div>
    </div>
  )
}
