import { create } from 'zustand';
import type { UserProfile, MovieListTab, MainView, MovieWithDetails } from '../types';
import type { IptvChannel, StreamPlaylistRecord } from '../types/streaming';

export interface ResumeTarget {
  channel: IptvChannel;
  positionSec: number;
}

interface AppState {
  activeProfile: UserProfile;
  setActiveProfile: (profile: UserProfile) => void;

  activeTab: MovieListTab;
  setActiveTab: (tab: MovieListTab) => void;

  mainView: MainView;
  setMainView: (view: MainView) => void;

  // Search Modal
  isSearchModalOpen: boolean;
  openSearchModal: () => void;
  closeSearchModal: () => void;

  // Roulette Modal
  isRouletteModalOpen: boolean;
  openRouletteModal: () => void;
  closeRouletteModal: () => void;

  // Rating Modal
  isRatingModalOpen: boolean;
  ratingMovie: MovieWithDetails | null;
  openRatingModal: (movie: MovieWithDetails) => void;
  closeRatingModal: () => void;

  // Details Modal
  isDetailsModalOpen: boolean;
  detailsMovie: MovieWithDetails | null;
  openDetailsModal: (movie: MovieWithDetails) => void;
  closeDetailsModal: () => void;

  // Add Music Modal (link Spotify/Deezer da Etapa 4)
  isAddMusicModalOpen: boolean;
  openAddMusicModal: () => void;
  closeAddMusicModal: () => void;

  // Busca de streaming (tocar direto no app)
  isStreamSearchOpen: boolean;
  streamSearchTargetPlaylistId: string | null;
  openStreamSearch: (targetPlaylistId?: string | null) => void;
  closeStreamSearch: () => void;

  // Exportar playlist pra Spotify / YouTube Music / Deezer
  exportPlaylist: StreamPlaylistRecord | null;
  openExportModal: (playlist: StreamPlaylistRecord) => void;
  closeExportModal: () => void;

  // Playlist aberta na tela de música
  selectedPlaylistId: string | null;
  setSelectedPlaylistId: (id: string | null) => void;

  /**
   * Alguem clicou em "continuar assistindo" na tela inicial: guarda o
   * que abrir e em que segundo, e a aba de TV pega isso ao montar.
   */
  resumeTarget: ResumeTarget | null;
  requestResume: (target: ResumeTarget) => void;
  clearResume: () => void;

  // Cadastro da lista de IPTV
  isIptvSourceModalOpen: boolean;
  openIptvSourceModal: () => void;
  closeIptvSourceModal: () => void;

  // Conteúdo adulto do IPTV fica atrás de um PIN pra ninguém abrir sem querer
  isAdultUnlocked: boolean;
  unlockAdult: (pin: string) => boolean;
  lockAdult: () => void;

  // Letra da música aberta
  isLyricsOpen: boolean;
  toggleLyrics: () => void;
  closeLyrics: () => void;
}

const savedProfile = (localStorage.getItem('nossa_sessao_profile') as UserProfile) || 'eduardo';

export const useAppStore = create<AppState>((set) => ({
  activeProfile: savedProfile,
  setActiveProfile: (profile) => {
    localStorage.setItem('nossa_sessao_profile', profile);
    set({ activeProfile: profile });
  },

  activeTab: 'match',
  setActiveTab: (tab) => set({ activeTab: tab }),

  mainView: 'movies',
  setMainView: (view) => set({ mainView: view }),

  isSearchModalOpen: false,
  openSearchModal: () => set({ isSearchModalOpen: true }),
  closeSearchModal: () => set({ isSearchModalOpen: false }),

  isRouletteModalOpen: false,
  openRouletteModal: () => set({ isRouletteModalOpen: true }),
  closeRouletteModal: () => set({ isRouletteModalOpen: false }),

  isRatingModalOpen: false,
  ratingMovie: null,
  openRatingModal: (movie) => set({ isRatingModalOpen: true, ratingMovie: movie }),
  closeRatingModal: () => set({ isRatingModalOpen: false, ratingMovie: null }),

  isDetailsModalOpen: false,
  detailsMovie: null,
  openDetailsModal: (movie) => set({ isDetailsModalOpen: true, detailsMovie: movie }),
  closeDetailsModal: () => set({ isDetailsModalOpen: false, detailsMovie: null }),

  isAddMusicModalOpen: false,
  openAddMusicModal: () => set({ isAddMusicModalOpen: true }),
  closeAddMusicModal: () => set({ isAddMusicModalOpen: false }),

  isStreamSearchOpen: false,
  streamSearchTargetPlaylistId: null,
  openStreamSearch: (targetPlaylistId = null) =>
    set({ isStreamSearchOpen: true, streamSearchTargetPlaylistId: targetPlaylistId }),
  closeStreamSearch: () => set({ isStreamSearchOpen: false, streamSearchTargetPlaylistId: null }),

  exportPlaylist: null,
  openExportModal: (playlist) => set({ exportPlaylist: playlist }),
  closeExportModal: () => set({ exportPlaylist: null }),

  selectedPlaylistId: null,
  setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id }),

  resumeTarget: null,
  requestResume: (target) => set({ resumeTarget: target, mainView: 'tv' }),
  clearResume: () => set({ resumeTarget: null }),

  isIptvSourceModalOpen: false,
  openIptvSourceModal: () => set({ isIptvSourceModalOpen: true }),
  closeIptvSourceModal: () => set({ isIptvSourceModalOpen: false }),

  isAdultUnlocked: false,
  unlockAdult: (pin) => {
    const expected = import.meta.env.VITE_ADULT_PIN || '0000';
    if (pin !== expected) return false;
    set({ isAdultUnlocked: true });
    return true;
  },
  lockAdult: () => set({ isAdultUnlocked: false }),

  isLyricsOpen: false,
  toggleLyrics: () => set((state) => ({ isLyricsOpen: !state.isLyricsOpen })),
  closeLyrics: () => set({ isLyricsOpen: false }),
}));
