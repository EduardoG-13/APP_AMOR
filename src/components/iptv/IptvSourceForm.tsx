import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { IptvSourceRecord, UserProfile } from '../../types';

interface IptvSourceFormProps {
  sources: IptvSourceRecord[];
  activeSource: IptvSourceRecord | null;
  activeProfile: UserProfile;
  isLoadingChannels: boolean;
  isSavingSource: boolean;
  saveSourceError: Error | null;
  onSelect: (source: IptvSourceRecord) => void;
  onReload: (source: IptvSourceRecord) => void;
  onDelete: (id: string) => void;
  onSave: (input: {
    label: string;
    kind: 'm3u' | 'xtream';
    m3uUrl?: string;
    xtreamHost?: string;
    xtreamUsername?: string;
    xtreamPassword?: string;
    profile: UserProfile;
  }) => Promise<unknown>;
}

const EMPTY_FORM = {
  label: '',
  kind: 'm3u' as 'm3u' | 'xtream',
  m3uUrl: '',
  xtreamHost: '',
  xtreamUsername: '',
  xtreamPassword: '',
};

export function IptvSourceForm({
  sources,
  activeSource,
  activeProfile,
  isLoadingChannels,
  isSavingSource,
  saveSourceError,
  onSelect,
  onReload,
  onDelete,
  onSave,
}: IptvSourceFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const handleSave = async () => {
    await onSave({ ...form, profile: activeProfile });
    setForm(EMPTY_FORM);
    setIsOpen(false);
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-cinema-base border border-cinema-border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent-blue';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className={cn(
              'flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-xs font-bold transition-colors',
              activeSource?.id === source.id
                ? 'bg-accent-blue/15 border-accent-blue/40 text-white'
                : 'bg-cinema-base/60 border-cinema-border text-slate-400'
            )}
          >
            <button onClick={() => onSelect(source)} className="flex items-center gap-2">
              <span className="truncate max-w-[140px]">{source.label}</span>
              {source.channel_count ? (
                <span className="text-[10px] font-medium text-slate-500">
                  {source.channel_count.toLocaleString('pt-BR')}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Remover a lista "${source.label}"?`)) onDelete(source.id);
              }}
              className="p-1 rounded-lg text-slate-600 hover:text-accent-pink transition-colors"
              aria-label="Remover lista"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {activeSource && (
          <button
            onClick={() => onReload(activeSource)}
            disabled={isLoadingChannels}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Recarregar a lista"
          >
            <RefreshCw className={cn('w-3 h-3', isLoadingChannels && 'animate-spin')} />
            <span className="hidden xs:inline">Recarregar</span>
          </button>
        )}

        <button
          onClick={() => setIsOpen((value) => !value)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-blue/20 text-accent-blue border border-accent-blue/30 text-xs font-bold hover:bg-accent-blue/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nova lista
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fadeIn">
          <div className="flex gap-2">
            {(['m3u', 'xtream'] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => setForm((current) => ({ ...current, kind }))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                  form.kind === kind
                    ? 'bg-accent-blue/20 border-accent-blue/40 text-white'
                    : 'bg-cinema-base border-cinema-border text-slate-400'
                )}
              >
                {kind === 'm3u' ? 'Link M3U' : 'Xtream'}
              </button>
            ))}
          </div>

          <input
            value={form.label}
            onChange={(event) => setForm((c) => ({ ...c, label: event.target.value }))}
            placeholder="Apelido da lista (ex: Meu provedor)"
            className={inputClass}
          />

          {form.kind === 'm3u' ? (
            <input
              value={form.m3uUrl}
              onChange={(event) => setForm((c) => ({ ...c, m3uUrl: event.target.value }))}
              placeholder="http://servidor.com/get.php?username=...&password=..."
              className={inputClass}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={form.xtreamHost}
                onChange={(event) => setForm((c) => ({ ...c, xtreamHost: event.target.value }))}
                placeholder="host:porta"
                className={inputClass}
              />
              <input
                value={form.xtreamUsername}
                onChange={(event) => setForm((c) => ({ ...c, xtreamUsername: event.target.value }))}
                placeholder="usuário"
                className={inputClass}
              />
              <input
                value={form.xtreamPassword}
                onChange={(event) => setForm((c) => ({ ...c, xtreamPassword: event.target.value }))}
                type="password"
                placeholder="senha"
                className={inputClass}
              />
            </div>
          )}

          {saveSourceError && (
            <p className="text-xs text-rose-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {saveSourceError.message}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={
              isSavingSource || (form.kind === 'm3u' ? !form.m3uUrl.trim() : !form.xtreamHost.trim())
            }
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-bold disabled:opacity-40 hover:brightness-110 transition-all"
          >
            {isSavingSource ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Testando a lista...
              </>
            ) : (
              'Salvar e carregar'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
