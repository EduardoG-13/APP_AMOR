import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { StreamTrack, UserProfile } from '../types';

/**
 * "Ouvir junto" / "Assistir junto".
 *
 * Em vez de transmitir mídia de um celular pro outro (WebRTC, que
 * gasta bateria e entrega imagem ruim), cada aparelho toca a própria
 * cópia e a gente sincroniza só a posição — é como o Teleparty faz.
 *
 * Decisão importante: a sincronia NÃO usa o relógio dos aparelhos.
 * Dois celulares podem estar segundos diferentes entre si, e isso
 * viraria um erro fixo impossível de corrigir. Em vez disso, quem
 * está comandando manda a posição a cada poucos segundos e quem
 * segue corrige se estiver longe demais. Simples e não dá dor de
 * cabeça.
 */

export const PARTY_ROOM = 'nossa-sessao';

/** Acima disso o player pula pra posição do outro. */
export const DRIFT_TOLERANCE_SEC = 1.2;

/** De quanto em quanto tempo quem comanda reenvia a posição. */
export const HEARTBEAT_MS = 4000;

export interface PartySyncMessage {
  kind: 'music' | 'iptv';
  /** videoId da faixa ou URL do canal. */
  ref: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  positionSec: number;
  isPlaying: boolean;
  from: UserProfile;
  /** Pra quem entra no meio receber a mesma fila. */
  queue?: StreamTrack[];
  queueIndex?: number;
}

export interface PartyMember {
  profile: UserProfile;
  onlineAt: string;
}

type SyncListener = (message: PartySyncMessage) => void;
type MembersListener = (members: PartyMember[]) => void;

class PartyBus {
  private channel: RealtimeChannel | null = null;
  private profile: UserProfile | null = null;
  private syncListeners = new Set<SyncListener>();
  private membersListeners = new Set<MembersListener>();
  private members: PartyMember[] = [];

  get isJoined() {
    return this.channel !== null;
  }

  getMembers() {
    return this.members;
  }

  join(profile: UserProfile) {
    if (this.channel && this.profile === profile) return;
    this.leave();

    this.profile = profile;
    const channel = supabase.channel(`party:${PARTY_ROOM}`, {
      config: {
        // Não queremos ouvir o eco do que nós mesmos mandamos.
        broadcast: { self: false },
        presence: { key: profile },
      },
    });

    channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const message = payload as PartySyncMessage;
      if (!message || message.from === this.profile) return;
      for (const listener of this.syncListeners) listener(message);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ profile: UserProfile; onlineAt: string }>();
      this.members = Object.values(state)
        .flat()
        .map((entry) => ({ profile: entry.profile, onlineAt: entry.onlineAt }));
      for (const listener of this.membersListeners) listener(this.members);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ profile, onlineAt: new Date().toISOString() });
      }
    });

    this.channel = channel;
  }

  leave() {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.members = [];
    for (const listener of this.membersListeners) listener(this.members);
  }

  publish(message: Omit<PartySyncMessage, 'from'>) {
    if (!this.channel || !this.profile) return;

    void this.channel.send({
      type: 'broadcast',
      event: 'sync',
      payload: { ...message, from: this.profile } satisfies PartySyncMessage,
    });
  }

  onSync(listener: SyncListener) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  onMembers(listener: MembersListener) {
    this.membersListeners.add(listener);
    listener(this.members);
    return () => this.membersListeners.delete(listener);
  }
}

export const partyBus = new PartyBus();

/**
 * Guarda o último estado no banco pra quem abrir o app depois já cair
 * no ponto certo. Só nos eventos que importam — a batida de 4s fica
 * só no Realtime, senão vira escrita demais no Postgres.
 */
export async function persistPartyState(input: {
  kind: 'idle' | 'music' | 'iptv';
  item: PartySyncMessage | null;
  positionSec: number;
  isPlaying: boolean;
  controller: UserProfile;
}) {
  const { error } = await supabase
    .from('party_sessions')
    .update({
      kind: input.kind,
      item_ref: input.item
        ? {
            kind: input.item.kind,
            ref: input.item.ref,
            title: input.item.title,
            subtitle: input.item.subtitle,
            coverUrl: input.item.coverUrl,
          }
        : null,
      position_sec: Math.max(0, input.positionSec),
      is_playing: input.isPlaying,
      controller: input.controller,
      started_at: new Date().toISOString(),
    })
    .eq('room', PARTY_ROOM);

  if (error) console.warn('Não consegui salvar o estado da sessão:', error.message);
}

export async function loadPartyState() {
  const { data, error } = await supabase
    .from('party_sessions')
    .select('*')
    .eq('room', PARTY_ROOM)
    .maybeSingle();

  if (error) return null;
  return data;
}
