import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Check,
  Loader2,
  ExternalLink,
  RefreshCw,
  Link2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import {
  connectDeezer,
  getConnectionStatus,
  oauthStartUrl,
  playlistFileUrl,
  syncPlaylistToPlatform,
} from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import type { ExportPlatform, ExportSyncResult } from '../../types';
import { cn } from '../../lib/utils';

const PLATFORMS: Array<{
  id: ExportPlatform;
  name: string;
  hint: string;
  accent: string;
}> = [
  {
    id: 'spotify',
    name: 'Spotify',
    hint: 'Procura a faixa equivalente no catálogo do Spotify',
    accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    id: 'youtube',
    name: 'YouTube Music',
    hint: 'Match exato — as faixas já vêm daqui',
    accent: 'text-red-400 border-red-500/30 bg-red-500/10',
  },
  {
    id: 'deezer',
    name: 'Deezer',
    hint: 'Conecta com o cookie "arl" da conta',
    accent: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10',
  },
];

export function ExportPlaylistModal() {
  const { exportPlaylist, closeExportModal, activeProfile } = useAppStore();

  const [busy, setBusy] = useState<ExportPlatform | null>(null);
  const [results, setResults] = useState<Partial<Record<ExportPlatform, ExportSyncResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<ExportPlatform, string>>>({});
  const [arlOpen, setArlOpen] = useState(false);
  const [arl, setArl] = useState('');

  const { data: status, refetch, isLoading } = useQuery({
    queryKey: ['oauth-status', activeProfile],
    queryFn: () => getConnectionStatus(activeProfile),
    enabled: Boolean(exportPlaylist),
    retry: false,
  });

  // Ao voltar do OAuth o backend devolve ?connected=spotify&status=ok.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      void refetch();
      params.delete('connected');
      params.delete('status');
      params.delete('view');
      const query = params.toString();
      window.history.replaceState({}, '', query ? `?${query}` : window.location.pathname);
    }
  }, [refetch]);

  useEffect(() => {
    if (!exportPlaylist) {
      setResults({});
      setErrors({});
      setArlOpen(false);
      setArl('');
    }
  }, [exportPlaylist]);

  if (!exportPlaylist) return null;

  const handleSync = async (platform: ExportPlatform) => {
    setBusy(platform);
    setErrors((current) => ({ ...current, [platform]: undefined }));

    try {
      const result = await syncPlaylistToPlatform({
        playlistId: exportPlaylist.id,
        platform,
        profile: activeProfile,
      });
      setResults((current) => ({ ...current, [platform]: result }));
    } catch (error) {
      setErrors((current) => ({ ...current, [platform]: (error as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const handleConnectDeezer = async () => {
    setBusy('deezer');
    setErrors((current) => ({ ...current, deezer: undefined }));

    try {
      await connectDeezer(activeProfile, arl.trim());
      setArl('');
      setArlOpen(false);
      await refetch();
    } catch (error) {
      setErrors((current) => ({ ...current, deezer: (error as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-[6vh] overflow-y-auto"
      onClick={closeExportModal}
    >
      <div
        className="w-full max-w-lg glass-modal rounded-3xl shadow-2xl animate-fadeIn"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-white">Exportar playlist</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              "{exportPlaylist.name}" · conta de {activeProfile === 'eduardo' ? 'Eduardo' : 'Laura'}
            </p>
          </div>
          <button
            onClick={closeExportModal}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Na primeira vez a playlist é <strong className="text-white">criada</strong> na
            plataforma. Depois, o mesmo botão só{' '}
            <strong className="text-white">acrescenta as músicas novas</strong> na playlist que já
            existe.
          </p>

          {isLoading ? (
            <p className="py-6 text-center text-xs text-slate-500">Vendo quais contas estão ligadas...</p>
          ) : (
            PLATFORMS.map((platform) => {
              const state = status?.[platform.id];
              const result = results[platform.id];
              const errorMessage = errors[platform.id];
              const isBusy = busy === platform.id;

              return (
                <div
                  key={platform.id}
                  className="rounded-2xl border border-cinema-border bg-cinema-surface/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{platform.name}</span>
                        {state?.connected && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-2.5 h-2.5" />
                            {state.displayName || 'ligado'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{platform.hint}</p>
                    </div>

                    {state?.connected ? (
                      <button
                        onClick={() => handleSync(platform.id)}
                        disabled={isBusy}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all disabled:opacity-50',
                          platform.accent
                        )}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {result ? 'Sincronizar' : 'Enviar'}
                      </button>
                    ) : platform.id === 'deezer' ? (
                      <button
                        onClick={() => setArlOpen((value) => !value)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cinema-border bg-cinema-elevated text-xs font-bold text-white whitespace-nowrap hover:bg-cinema-border transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Conectar
                      </button>
                    ) : state?.configured ? (
                      <a
                        href={oauthStartUrl(
                          platform.id === 'youtube' ? 'google' : 'spotify',
                          activeProfile
                        )}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cinema-border bg-cinema-elevated text-xs font-bold text-white whitespace-nowrap hover:bg-cinema-border transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Conectar
                      </a>
                    ) : (
                      <span className="text-[10px] text-amber-400/90 text-right max-w-[130px] leading-tight">
                        Falta configurar as chaves no backend
                      </span>
                    )}
                  </div>

                  {platform.id === 'deezer' && arlOpen && !state?.connected && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-fadeIn">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        A Deezer fechou o cadastro de apps novos, então a conexão é pelo cookie da
                        própria conta: abra <strong className="text-white">deezer.com</strong>{' '}
                        logado, <strong className="text-white">F12 → Application → Cookies</strong>,
                        copie o valor de <code className="text-accent-purple">arl</code>.
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={arl}
                          onChange={(event) => setArl(event.target.value)}
                          type="password"
                          placeholder="Cole o arl aqui"
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-cinema-base border border-cinema-border text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple"
                        />
                        <button
                          onClick={handleConnectDeezer}
                          disabled={busy === 'deezer' || arl.trim().length < 32}
                          className="px-3 py-2 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 text-xs font-bold disabled:opacity-40"
                        >
                          {busy === 'deezer' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Salvar'
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-amber-400/80 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        Esse cookie vale como senha da conta. Fica guardado no Supabase, numa tabela
                        que o app não consegue ler — só o backend.
                      </p>
                    </div>
                  )}

                  {errorMessage && (
                    <p className="mt-2 text-[11px] text-rose-400 leading-relaxed">{errorMessage}</p>
                  )}

                  {result && (
                    <div className="mt-3 pt-3 border-t border-white/5 text-[11px] space-y-1.5">
                      <p className="text-emerald-300 font-semibold">
                        {result.action === 'created' ? 'Playlist criada!' : 'Playlist atualizada!'}{' '}
                        {result.added > 0
                          ? `${result.added} ${result.added === 1 ? 'música nova' : 'músicas novas'}`
                          : 'nada novo pra mandar'}
                        {result.alreadyThere > 0 && ` · ${result.alreadyThere} já estavam lá`}
                      </p>

                      {result.remoteUrl && (
                        <a
                          href={result.remoteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent-blue hover:underline font-semibold"
                        >
                          Abrir no {platform.name} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {result.notFound.length > 0 && (
                        <details className="text-slate-400">
                          <summary className="cursor-pointer hover:text-slate-300">
                            {result.notFound.length}{' '}
                            {result.notFound.length === 1
                              ? 'música não existe lá'
                              : 'músicas não existem lá'}
                          </summary>
                          <ul className="mt-1 pl-3 space-y-0.5">
                            {result.notFound.map((item) => (
                              <li key={`${item.title}-${item.artist}`} className="truncate">
                                • {item.title} — {item.artist}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="pt-1 flex items-center justify-center gap-4 text-[11px]">
            <a
              href={playlistFileUrl(exportPlaylist.id, 'm3u')}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Download className="w-3 h-3" /> Baixar .m3u
            </a>
            <a
              href={playlistFileUrl(exportPlaylist.id, 'csv')}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Formato que o Soundiiz e o TuneMyMusic importam"
            >
              <Download className="w-3 h-3" /> Baixar .csv
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
