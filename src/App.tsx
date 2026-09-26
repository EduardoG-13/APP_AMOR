import React from 'react';
import { Header } from './components/common/Header';
import { HeroSection } from './components/hero/HeroSection';
import { MovieList } from './components/movies/MovieList';
import { MovieSearchModal } from './components/movies/MovieSearchModal';
import { MovieRouletteModal } from './components/movies/MovieRouletteModal';
import { MovieRatingModal } from './components/movies/MovieRatingModal';
import { MovieDetailsModal } from './components/movies/MovieDetailsModal';
import { MusicSection } from './components/music/MusicSection';
import { useMovies } from './hooks/useMovies';
import { useAppStore } from './store/useAppStore';
import { Loader2, AlertCircle } from 'lucide-react';

export function App() {
  const {
    movies,
    isLoading,
    isError,
    error,
    addMovie,
    toggleInterest,
    deleteMovie,
    rateMovie,
  } = useMovies();

  const { mainView, activeProfile } = useAppStore();

  const handleAddMovie = async (tmdbMovie: any) => {
    await addMovie({ tmdbMovie, profile: activeProfile });
  };

  const handleToggleInterest = async (
    watchlistId: string,
    currentVal: boolean,
    partnerVal: boolean
  ) => {
    await toggleInterest({
      watchlistId,
      profile: activeProfile,
      currentValue: currentVal,
      partnerValue: partnerVal,
    });
  };

  return (
    <div className="min-h-screen bg-cinema-base text-slate-100 flex flex-col antialiased">
      {/* Top Navigation */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Connection Error Notification */}
        {isError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Aviso de Conexão com o Supabase</p>
              <p className="text-xs text-rose-400 mt-0.5">
                {(error as any)?.message || 'Verifique se as tabelas foram criadas no banco de dados e as chaves no .env estão corretas.'}
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-accent-purple mb-4" />
            <span className="text-sm font-medium">Carregando o cinema de vocês...</span>
          </div>
        ) : mainView === 'movies' ? (
          <div>
            <HeroSection movies={movies} />
            <MovieList
              movies={movies}
              onToggleInterest={handleToggleInterest}
              onDelete={deleteMovie}
            />
          </div>
        ) : (
          <MusicSection movies={movies} />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-cinema-border/50 py-6 mt-12 bg-cinema-base/40">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          Feito com carinho para <strong className="text-accent-blue">Eduardo</strong> &amp;{' '}
          <strong className="text-accent-pink">Laura</strong> • 🍿 Nossa Sessão © 2026
        </div>
      </footer>

      {/* Global Modals */}
      <MovieSearchModal
        onAddMovie={handleAddMovie}
        existingMovies={movies}
      />
      <MovieRouletteModal movies={movies} />
      <MovieRatingModal onSaveRating={rateMovie} />
      <MovieDetailsModal />
    </div>
  );
}

export default App;
