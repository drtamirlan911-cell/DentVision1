type DiagnosticAuthDb = {
  referral: {
    findUnique: (args: any) => Promise<{ clinicId: string; doctorId: string | null } | null>;
  };
  clinicMember: {
    findFirst: (args: any) => Promise<{ userId: string; role: string } | null>;
  };
};

/**
 * Diagnostic results become part of the patient's clinical record when signed.
 * Signing is therefore a clinical action and must be restricted to a doctor.
 *
 * The referral's assigned doctor is always allowed. A different doctor from
 * the same clinic may also sign when explicitly permitted by the clinic role
 * model. Owner/Admin/Lab/Center users are never accepted by this guard.
 */
export async function assertDiagnosticSignerIsDoctor(
  db: DiagnosticAuthDb,
  referralId: string,
  signerId: string,
): Promise<void> {
  const referral = await db.referral.findUnique({
    where: { id: referralId },
    select: { clinicId: true, doctorId: true },
  });

  if (!referral) throw new Error('Referral not found');
  if (referral.doctorId === signerId) return;

  const doctorMember = await db.clinicMember.findFirst({
    where: {
      clinicId: referral.clinicId,
      userId: signerId,
      role: 'DOCTOR',
    },
    select: { userId: true, role: true },
  });

  if (!doctorMember) {
    throw new Error('Только врач может подписать результат диагностики');
  }
}
