import { useRef, useState } from 'react';
import { X, Camera, Loader2, Check, Trash2 } from 'lucide-react';
import { useCoupleProfiles } from '../../hooks/useCoupleProfiles';
import { cn } from '../../lib/utils';
import type { UserProfile } from '../../types';

interface ProfileEditorModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export function ProfileEditorModal({ profile, onClose }: ProfileEditorModalProps) {
  const { byProfile, save, isSaving, uploadAvatar, isUploading, uploadError } = useCoupleProfiles();
  const fileRef = useRef<HTMLInputElement>(null);

  const record = byProfile(profile);
  const [name, setName] = useState(
    record?.display_name || (profile === 'eduardo' ? 'Eduardo' : 'Laura')
  );
  const [saved, setSaved] = useState(false);

  const accent = profile === 'eduardo' ? 'accent-blue' : 'accent-pink';

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    await uploadAvatar({ profile, file });
  };

  const handleSaveName = async () => {
    await save({ profile, displayName: name });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm glass-modal rounded-3xl shadow-2xl animate-fadeIn"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-extrabold text-white">Seu perfil</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Foto */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className={cn(
                'relative w-24 h-24 rounded-full overflow-hidden border-2 group',
                `border-${accent}`,
                'bg-cinema-elevated flex items-center justify-center'
              )}
            >
              {record?.avatar_url ? (
                <img src={record.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-extrabold text-slate-600">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}

              <span className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Enviando...' : 'Trocar foto'}
              </button>

              {record?.avatar_url && (
                <button
                  onClick={() => void save({ profile, avatarUrl: null })}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-accent-pink transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Tirar
                </button>
              )}
            </div>

            {uploadError && (
              <p className="text-[11px] text-rose-400 text-center">{uploadError.message}</p>
            )}
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Como você aparece
            </label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSaveName()}
                maxLength={24}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-cinema-base border border-cinema-border text-sm text-white focus:outline-none focus:border-accent-purple"
              />
              <button
                onClick={handleSaveName}
                disabled={isSaving || !name.trim()}
                className="px-4 py-2.5 rounded-xl bg-accent-purple text-white text-xs font-bold disabled:opacity-40 hover:brightness-110 transition-all"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
