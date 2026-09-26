import { create } from 'zustand';
import type { StreamTrack } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PendingRemote {
  positionSec: number;
  isPlaying: boolean;
  /** Muda a cada comando pra o efeito disparar mesmo em valores iguais. */
  nonce: number;
}

interface PlayerState {
  queue: StreamTrack[];
  index: number;
  isPlaying: boolean;
  /** Mostra o videoclipe em vez de só o áudio. */
  showVideo: boolean;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;

  /** "Ouvir junto" ligado. */
  partyEnabled: boolean;
  /** Comando que chegou do parceiro e o player ainda vai aplicar. */
  pendingRemote: PendingRemote | null;

  currentTrack: () => StreamTrack | null;

  playQueue: (tracks: StreamTrack[], startIndex?: number) => void;
  playTrack: (track: StreamTrack) => void;
  enqueue: (track: StreamTrack) => void;
  removeAt: (index: number) => void;
  goTo: (index: number) => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  clearQueue: () => void;

  setPlaying: (value: boolean) => void;
  toggleVideo: () => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;

  setPartyEnabled: (value: boolean) => void;
  applyRemote: (command: Omit<PendingRemote, 'nonce'>) => void;
  consumeRemote: () => void;
  /** Substitui a fila sem reiniciar o que já está tocando. */
  adoptQueue: (tracks: StreamTrack[], index: number) => void;
}

const savedVolume = Number(localStorage.getItem('nossa_sessao_volume'));

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: 0,
  isPlaying: false,
  showVideo: false,
  volume: Number.isFinite(savedVolume) && savedVolume > 0 ? savedVolume : 0.85,
  muted: false,
  repeat: 'off',
  shuffle: false,

  partyEnabled: false,
  pendingRemote: null,

  currentTrack: () => {
    const { queue, index } = get();
    return queue[index] ?? null;
  },

  playQueue: (tracks, startIndex = 0) => {
    if (tracks.length === 0) return;
    set({ queue: tracks, index: Math.min(Math.max(startIndex, 0), tracks.length - 1), isPlaying: true });
  },

  playTrack: (track) => {
    const { queue } = get();
    const existing = queue.findIndex((item) => item.sourceId === track.sourceId);

    if (existing >= 0) {
      set({ index: existing, isPlaying: true });
      return;
    }

    set({ queue: [...queue, track], index: queue.length, isPlaying: true });
  },

  enqueue: (track) => {
    const { queue } = get();
    if (queue.some((item) => item.sourceId === track.sourceId)) return;
    set({ queue: [...queue, track] });
  },

  removeAt: (position) => {
    const { queue, index } = get();
    if (position < 0 || position >= queue.length) return;

    const nextQueue = queue.filter((_, i) => i !== position);
    let nextIndex = index;
    if (position < index) nextIndex -= 1;
    else if (position === index) nextIndex = Math.min(index, nextQueue.length - 1);

    set({
      queue: nextQueue,
      index: Math.max(nextIndex, 0),
      isPlaying: nextQueue.length > 0 && get().isPlaying,
    });
  },

  goTo: (position) => {
    const { queue } = get();
    if (position < 0 || position >= queue.length) return;
    set({ index: position, isPlaying: true });
  },

  next: (auto = false) => {
    const { queue, index, repeat, shuffle } = get();
    if (queue.length === 0) return;

    // Repeat "one" só repete sozinho no fim da faixa; se a pessoa
    // apertou "próxima", ela quer a próxima de verdade.
    if (auto && repeat === 'one') {
      set({ pendingRemote: { positionSec: 0, isPlaying: true, nonce: Date.now() } });
      return;
    }

    if (shuffle && queue.length > 1) {
      let random = index;
      while (random === index) random = Math.floor(Math.random() * queue.length);
      set({ index: random, isPlaying: true });
      return;
    }

    if (index + 1 < queue.length) {
      set({ index: index + 1, isPlaying: true });
      return;
    }

    if (repeat === 'all') {
      set({ index: 0, isPlaying: true });
      return;
    }

    set({ isPlaying: false });
  },

  previous: () => {
    const { index } = get();
    if (index > 0) set({ index: index - 1, isPlaying: true });
    else set({ pendingRemote: { positionSec: 0, isPlaying: true, nonce: Date.now() } });
  },

  clearQueue: () => set({ queue: [], index: 0, isPlaying: false }),

  setPlaying: (value) => set({ isPlaying: value }),
  toggleVideo: () => set((state) => ({ showVideo: !state.showVideo })),

  setVolume: (value) => {
    localStorage.setItem('nossa_sessao_volume', String(value));
    set({ volume: value, muted: value === 0 });
  },

  toggleMute: () => set((state) => ({ muted: !state.muted })),

  cycleRepeat: () =>
    set((state) => ({
      repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
    })),

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  setPartyEnabled: (value) => set({ partyEnabled: value }),

  applyRemote: (command) => set({ pendingRemote: { ...command, nonce: Date.now() } }),
  consumeRemote: () => set({ pendingRemote: null }),

  adoptQueue: (tracks, index) =>
    set({ queue: tracks, index: Math.min(Math.max(index, 0), Math.max(tracks.length - 1, 0)) }),
}));
