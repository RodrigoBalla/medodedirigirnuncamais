import { Component, type ErrorInfo, type ReactNode } from "react";

// ─── ErrorBoundary ───────────────────────────────────────────────────────────
// Evita que um erro em UM componente derrube a árvore inteira (tela branca).
// Renderiza um fallback compacto e loga no console.
// =============================================================================

interface Props {
  children: ReactNode;
  /** Nome opcional do bloco — aparece no fallback e no console */
  label?: string;
  /** Fallback custom. Se omitido, renderiza um aviso minimalista */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMsg: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, errorMsg: err.message ?? String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? "anon"}]`, err, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 mb-6 text-center">
          <span className="material-symbols-outlined text-destructive mb-1 block text-2xl">error</span>
          <p className="text-xs font-bold text-destructive">
            {this.props.label ? `Erro em "${this.props.label}"` : "Algo deu errado neste bloco"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 break-all">
            {this.state.errorMsg}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: "" })}
            className="mt-2 text-[10px] font-bold text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
