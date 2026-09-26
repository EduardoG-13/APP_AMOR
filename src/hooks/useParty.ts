import { useCallback, useEffect, useRef, useState } from 'react';
import { partyBus, persistPartyState, type PartyMember, type PartySyncMessage } from '../lib/party';
import { useAppStore } from '../store/useAppStore';
import { usePlayerStore } from '../store/usePlayerStore';

interface UsePartyOptions {
  /** Só recebe mensagens deste tipo (música ou IPTV). */
  kind: 'music' | 'iptv';
  onSync?: (message: PartySyncMessage) => void;
}

/**
 * Liga um player ao canal do casal. Quem mexe nos controles vira o
 * comandante e manda a posição; o outro acompanha.
 */
export function useParty({ kind, onSync }: UsePartyOptions) {
  const activeProfile = useAppStore((state) => state.activeProfile);
  const enabled = usePlayerStore((state) => state.partyEnabled);
  const setPartyEnabled = usePlayerStore((state) => state.setPartyEnabled);

  const [members, setMembers] = useState<PartyMember[]>([]);
  const [controller, setController] = useState<string | null>(null);

  // Callback num ref: assim reconectar não depende da identidade da
  // função. A escrita vai num efeito porque mexer em ref durante o
  // render quebra com renderização concorrente.
  const onSyncRef = useRef(onSync);
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (!enabled) {
      partyBus.leave();
      setMembers([]);
      setController(null);
      return;
    }

    partyBus.join(activeProfile);

    const offMembers = partyBus.onMembers(setMembers);
    const offSync = partyBus.onSync((message) => {
      if (message.kind !== kind) return;
      setController(message.from);
      onSyncRef.current?.(message);
    });

    return () => {
      offMembers();
      offSync();
    };
  }, [enabled, activeProfile, kind]);

  // Sai do canal ao fechar a aba pra a presença não ficar fantasma.
  useEffect(() => {
    const leave = () => partyBus.leave();
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, []);

  const publish = useCallback(
    (message: Omit<PartySyncMessage, 'from' | 'kind'>, options?: { persist?: boolean }) => {
      if (!enabled) return;

      partyBus.publish({ ...message, kind });
      setController(activeProfile);

      if (options?.persist) {
        void persistPartyState({
          kind,
          item: { ...message, kind, from: activeProfile },
          positionSec: message.positionSec,
          isPlaying: message.isPlaying,
          controller: activeProfile,
        });
      }
    },
    [enabled, kind, activeProfile]
  );

  const partner = activeProfile === 'eduardo' ? 'laura' : 'eduardo';
  const partnerOnline = members.some((member) => member.profile === partner);

  return {
    enabled,
    setEnabled: setPartyEnabled,
    members,
    partnerOnline,
    partner,
    controller,
    isController: controller === null || controller === activeProfile,
    publish,
  };
}
