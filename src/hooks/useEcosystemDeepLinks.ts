import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ecosystemPath, type EcosystemDeepLinkTarget, type EcosystemContextSelection } from '../config/ecosystemContextSelectors';

export function useEcosystemDeepLinks(selection: Partial<EcosystemContextSelection> = {}) {
  const navigate = useNavigate();
  const open = useCallback((target: EcosystemDeepLinkTarget, override: Partial<EcosystemContextSelection> = {}) => {
    navigate(ecosystemPath(target, { ...selection, ...override }));
  }, [navigate, selection]);

  return {
    open,
    path: (target: EcosystemDeepLinkTarget, override: Partial<EcosystemContextSelection> = {}) => ecosystemPath(target, { ...selection, ...override }),
  };
}
