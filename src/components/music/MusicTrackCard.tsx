import React from 'react';
import { motion } from 'framer-motion';
import { Music2, ExternalLink, Trash2, Heart, MessageSquare } from 'lucide-react';
import { MusicTrackRecord } from '../../types';

interface MusicTrackCardProps {
  track: MusicTrackRecord;
  onDelete: (trackId: string) => void;
}

export const MusicTrackCard: React.FC<MusicTrackCardProps> = ({ track, onDelete }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-4 rounded-2xl bg-cinema-surface border border-cinema-border hover:border-cinema-border/90 hover:shadow-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      {/* Left info: Cover + Title + Artist + Memory note */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-cinema-elevated overflow-hidden flex-shrink-0 border border-cinema-border shadow-md">
          {track.cover_url ? (
            <img
              src={track.cover_url}
              alt={track.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-accent-purple bg-accent-purple/10">
              <Music2 className="w-6 h-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-white text-sm sm:text-base line-clamp-1">
              {track.title}
            </h4>
            <span
              className={`hidden xs:inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                track.added_by === 'eduardo'
                  ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/30'
                  : 'bg-accent-pink/20 text-accent-pink border-accent-pink/30'
              }`}
            >
              {track.added_by === 'eduardo' ? 'Por Edu' : 'Por Lau'}
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
            {track.artist}
          </p>

          {track.memory_note && (
            <div className="flex items-center gap-1.5 text-xs text-accent-pink/90 font-medium mt-1">
              <Heart className="w-3 h-3 fill-accent-pink/40 flex-shrink-0" />
              <span className="truncate italic">"{track.memory_note}"</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions: Spotify & Deezer Bridges + Trash */}
      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
        {track.spotify_url && (
          <a
            href={track.spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#1DB954]/15 hover:bg-[#1DB954]/25 text-[#1DB954] border border-[#1DB954]/30 text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Abrir no Spotify (Eduardo)"
          >
            <span className="w-2 h-2 rounded-full bg-[#1DB954]" />
            <span>Spotify</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {track.deezer_url && (
          <a
            href={track.deezer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#A238FF]/15 hover:bg-[#A238FF]/25 text-[#C084FC] border border-[#A238FF]/30 text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Abrir no Deezer (Laura)"
          >
            <span className="w-2 h-2 rounded-full bg-[#A238FF]" />
            <span>Deezer</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <button
          onClick={() => {
            if (confirm(`Remover "${track.title}" da trilha sonora?`)) {
              onDelete(track.id);
            }
          }}
          className="p-2 rounded-xl bg-cinema-elevated hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors ml-1"
          title="Remover música"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
