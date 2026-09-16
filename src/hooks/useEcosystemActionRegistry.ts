import { useMemo } from 'react';
import { useEcosystemContext } from './useEcosystemContext';
import { actionById, actionsForParticipant, type EcosystemActionDefinition, type EcosystemActionId } from '../config/ecosystemActions';

export function useEcosystemActionRegistry() {
  const { participant, hasOrganization, hasClinic } = useEcosystemContext();

  const actions = useMemo(() => actionsForParticipant(participant), [participant]);

  const availableActions = useMemo(
    () => actions.filter(action =>
      (!action.requiresOrganization || hasOrganization) &&
      (!action.requiresClinic || hasClinic)
    ),
    [actions, hasClinic, hasOrganization],
  );

  const canOffer = (id: EcosystemActionId) => {
    const action = actionById(id);
    if (!action || !action.participants.includes(participant)) return false;
    if (action.requiresOrganization && !hasOrganization) return false;
    if (action.requiresClinic && !hasClinic) return false;
    return true;
  };

  return { actions, availableActions, canOffer };
}

export type { EcosystemActionDefinition, EcosystemActionId };
