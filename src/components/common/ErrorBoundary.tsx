import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  stack: string | null;
}

/**
 * Sem isto, qualquer exceção durante o render derruba a árvore
 * inteira e o app vira uma tela preta, sem pista nenhuma do motivo.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Nossa Sessão] erro na interface:', error, info.componentStack);
    this.setState({ stack: info.componentStack ?? null });
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-cinema-base text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-extrabold text-white">Alguma coisa quebrou aqui</h1>
              <p className="text-xs text-slate-400 mt-1">
                Nada foi perdido — é só a tela. Recarregue e, se continuar, me mande o texto abaixo.
              </p>
            </div>
          </div>

          <pre className="text-[11px] text-rose-200 bg-black/40 rounded-xl p-3 overflow-auto max-h-60 whitespace-pre-wrap">
            {error.message}
            {stack ? `\n${stack}` : ''}
          </pre>

          <button
            onClick={() => window.location.reload()}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-purple text-white text-sm font-bold hover:brightness-110 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Recarregar
          </button>
        </div>
      </div>
    );
  }
}
