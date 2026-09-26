import { create } from 'zustand';
import { UserProfile, MovieListTab, MainView, MovieWithDetails } from '../types';

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

  // Add Music Modal
  isAddMusicModalOpen: boolean;
  openAddMusicModal: () => void;
  closeAddMusicModal: () => void;
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
}));
