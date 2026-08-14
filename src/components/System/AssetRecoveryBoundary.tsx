import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { isAssetVersionError, recoverFromAssetVersionError } from '../../utils/versionRecovery';

interface State {
  error: Error | null;
  recovering: boolean;
}

interface Props {
  children?: React.ReactNode;
}

export class AssetRecoveryBoundary extends React.Component<Props, State> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, recovering: isAssetVersionError(error) };
  }

  componentDidCatch(error: Error): void {
    if (!isAssetVersionError(error)) return;
    void recoverFromAssetVersionError(error).then((started) => {
      if (!started) this.setState({ recovering: false });
    });
  }

  private reloadSafely = () => {
    this.setState({ recovering: true });
    void recoverFromAssetVersionError(this.state.error || new Error('Manual asset recovery'), true);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-5 font-sans text-slate-950">
        <section className="w-full max-w-md rounded-3xl border border-orange-200 bg-white p-7 text-center shadow-[0_24px_70px_rgba(124,45,18,.15)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            {this.state.recovering ? <RefreshCw className="h-6 w-6 animate-spin" /> : <TriangleAlert className="h-6 w-6" />}
          </div>
          <h1 className="mt-5 text-xl font-black">Memuat versi sistem terbaru</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
            Cache aplikasi tidak cocok dengan deployment terbaru. Sesi login dan data operasional Anda tetap aman.
          </p>
          <button
            type="button"
            onClick={this.reloadSafely}
            disabled={this.state.recovering}
            className="mt-6 w-full rounded-2xl bg-orange-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 disabled:opacity-60"
          >
            {this.state.recovering ? 'Membersihkan cache kode...' : 'Muat ulang dengan aman'}
          </button>
        </section>
      </main>
    );
  }
}
