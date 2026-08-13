import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Building2, Delete, KeyRound, Lock, ShieldAlert, ShieldCheck, UserCheck, Clock } from 'lucide-react';
import { Branch } from '../../types/pos';
import { INITIAL_BRANCHES } from '../../data/initialData';
import { DBStorage } from '../../services/dbStorage';
import { cloudPinLogin, type CloudLoginResult } from '../../services/authService';
import { cloudReadiness } from '../../lib/runtimeEnv';

type LoginMode = 'SYSTEM' | 'ATTENDANCE';

interface PinLoginUser {
  id: string;
  name: string | null;
  role: string | null;
  tenantId?: string | null;
  branchId?: string;
  permissions?: Record<string, boolean>;
  branchIds?: string[];
}

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: PinLoginUser, selectedBranch: Branch, mode: LoginMode) => void;
  branches?: Branch[];
  currentBranch?: Branch;
  onSelectBranch?: (branch: Branch) => void;
  canClose?: boolean;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  branches = INITIAL_BRANCHES,
  currentBranch = INITIAL_BRANCHES[0],
  onSelectBranch,
  canClose = false,
}) => {
  const [activeTab, setActiveTab] = useState<LoginMode>('SYSTEM');
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranch.id);
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const pinBufferRef = useRef('');
  const attemptSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || currentBranch;
  const useCloud = cloudReadiness.supabase;

  const resetEntry = useCallback((cancelPending = false) => {
    if (cancelPending) {
      attemptSequenceRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsVerifying(false);
    }
    pinBufferRef.current = '';
    setPinInput('');
  }, []);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const switchTab = (tab: LoginMode) => {
    resetEntry(true);
    setActiveTab(tab);
    setErrorMessage('');
  };

  const handleBranchChange = (branchId: string) => {
    resetEntry(true);
    setSelectedBranchId(branchId);
    const branch = branches.find((b) => b.id === branchId);
    if (branch) onSelectBranch?.(branch);
    setErrorMessage('');
  };

  const finishSuccess = (user: PinLoginUser, branch: Branch, mode: LoginMode) => {
    onSelectBranch?.(branch);
    onSuccessLogin(user, branch, mode);
    resetEntry();
    setErrorMessage('');
    setIsVerifying(false);
    if (canClose) onClose();
  };

  const verifyCloud = useCallback(async (pin: string, branch: Branch, mode: LoginMode) => {
    const attemptId = ++attemptSequenceRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsVerifying(true);
    try {
      const result: CloudLoginResult = await cloudPinLogin(branch.id, pin, controller.signal);
      if (controller.signal.aborted || attemptId !== attemptSequenceRef.current) return;
      if (result.success && result.user) {
        const canonicalBranch = branches.find((item) => item.id === result.user?.branchId)
          || { ...branch, id: result.user.branchId };
        finishSuccess(
          {
            id: result.user.id,
            name: result.user.name,
            role: result.user.role,
            tenantId: result.user.tenantId,
            branchId: result.user.branchId,
            permissions: result.user.permissions,
            branchIds: result.user.branchIds,
          },
          canonicalBranch,
          mode,
        );
        return;
      }

      const attempts = result.remainingAttempts !== undefined ? ` Sisa percobaan: ${result.remainingAttempts}.` : '';
      setErrorMessage(`${result.error || 'PIN tidak valid.'}${attempts}`);
    } catch (error) {
      if (controller.signal.aborted || attemptId !== attemptSequenceRef.current) return;
      setErrorMessage('Server autentikasi tidak dapat dihubungi.');
    } finally {
      if (attemptId !== attemptSequenceRef.current) return;
      abortControllerRef.current = null;
      setIsVerifying(false);
      resetEntry();
    }
  }, [resetEntry]);

  const verifyLocal = useCallback((pin: string, branch: Branch, mode: LoginMode) => {
    setIsVerifying(true);
    const result = DBStorage.authenticateByPin(branch.id, pin);
    if (result.success && result.user) {
      finishSuccess(
        {
          id: result.user.id,
          name: result.user.name,
          role: result.user.role,
        },
        branch,
        mode,
      );
      return;
    }
    const attempts = result.remainingAttempts !== undefined ? ` Sisa percobaan: ${result.remainingAttempts}.` : '';
    setErrorMessage(`${result.message}${attempts}`);
    resetEntry();
    setIsVerifying(false);
  }, [resetEntry]);

  const submitPin = useCallback((pin: string) => {
    if (pin.length !== 6 || isVerifying) return;
    const submittedBranch = activeBranch;
    const submittedMode = activeTab;
    if (useCloud) {
      void verifyCloud(pin, submittedBranch, submittedMode);
    } else {
      verifyLocal(pin, submittedBranch, submittedMode);
    }
  }, [useCloud, verifyCloud, verifyLocal, isVerifying, activeBranch, activeTab]);

  const handleKeyPress = (digit: string) => {
    if (isVerifying || pinBufferRef.current.length >= 6) return;
    const nextPin = (pinBufferRef.current + digit).slice(0, 6);
    pinBufferRef.current = nextPin;
    setPinInput(nextPin);
    setErrorMessage('');
    if (nextPin.length === 6) submitPin(nextPin);
  };

  const tabConfig = {
    SYSTEM: {
      icon: Lock,
      label: 'Login Sistem',
      subtitle: 'Akses Terminal',
      description: 'Masukkan PIN Petugas',
      hint: 'Role dan halaman awal ditentukan otomatis.',
      footerText: 'Sesi akan mengikuti outlet, peran, dan matriks akses yang terhubung dengan PIN.',
    },
    ATTENDANCE: {
      icon: Clock,
      label: 'Login Absensi',
      subtitle: 'Presensi Karyawan',
      description: 'PIN Karyawan',
      hint: 'Clock in / Clock out — sesi langsung berakhir.',
      footerText: 'Terminal ini hanya digunakan untuk presensi. Modul operasional dan data manajemen tidak dimuat.',
    },
  };

  const cfg = tabConfig[activeTab];
  const TabIcon = cfg.icon;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_var(--surface-card)_0%,_var(--surface-main)_48%,_var(--surface-secondary)_100%)] p-4 font-sans select-none animate-fadeIn">
      <div className="grid w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl md:grid-cols-[0.9fr_1.1fr]">
        {/* Left Panel */}
        <section className="flex flex-col justify-between bg-[var(--primary)] p-7 text-white">
          <div>
            {/* Tab Switcher */}
            <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/[0.06] p-1">
              {(['SYSTEM', 'ATTENDANCE'] as const).map((tab) => {
                const isActive = activeTab === tab;
                const Icon = tabConfig[tab].icon;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchTab(tab)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                      isActive
                        ? 'bg-[var(--primary)] text-white shadow-[var(--shadow-md)]'
                        : 'text-white/45 hover:text-white/70'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tabConfig[tab].label}
                  </button>
                );
              })}
            </div>

            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] shadow-[var(--shadow-md)]">
                <TabIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-300)]">
                  {activeTab === 'ATTENDANCE' ? 'Attendance kiosk' : 'Secure terminal'}
                </p>
                <h2 className="text-lg font-bold tracking-tight">{cfg.subtitle}</h2>
              </div>
            </div>

            {/* Branch Selector */}
            <label className="block rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                <Building2 className="h-3.5 w-3.5 text-[var(--brand-300)]" /> Pilih Cabang
              </span>
              <select
                aria-label="Pilih cabang"
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-white/15 bg-white px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[var(--brand-300)] focus:shadow-[var(--focus-ring)]"
                style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', colorScheme: 'light' }}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                    {branch.name}{branch.isMainBranch ? ' · Pusat' : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* Info Items */}
            <div className="mt-5 space-y-3">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-300)]" />
                <div>
                  <p className="text-xs font-bold">Akses otomatis berdasarkan PIN</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                    Sistem mengenali akun, role, dan menu yang diizinkan tanpa menampilkan daftar petugas.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-300)]" />
                <div>
                  <p className="text-xs font-bold">PIN bersifat pribadi</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                    Jangan berbagi PIN. Terminal akan terkunci sementara setelah beberapa percobaan gagal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] leading-relaxed text-white/45">
            {cfg.footerText}
          </div>
        </section>

        {/* Right Panel — PIN Entry */}
        <section className="p-7 md:p-8">
          <div className="mb-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {activeBranch.code || 'OUTLET'}
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">{cfg.description}</h3>
            <p className="mt-1 text-[11px] font-medium text-[var(--text-tertiary)]">{cfg.hint}</p>
          </div>

          {/* Hidden input for physical keyboard / numpad */}
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="PIN petugas"
            value={pinInput}
            readOnly={isVerifying}
            onKeyDown={(e) => {
              if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handleKeyPress(e.key);
              } else if (e.key === 'Backspace') {
                e.preventDefault();
                if (!isVerifying) {
                  pinBufferRef.current = pinBufferRef.current.slice(0, -1);
                  setPinInput(pinBufferRef.current);
                }
              }
            }}
            onChange={() => {/* controlled via onKeyDown only */}}
            className="sr-only"
          />

          {/* PIN dots */}
          <div className="mb-5 flex h-8 items-center justify-center gap-2.5" aria-label={`${pinInput.length} digit PIN terisi`}>
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                  i < pinInput.length
                    ? 'scale-110 border-[var(--primary)] bg-[var(--primary)]'
                    : 'border-[var(--panel-border-strong)] bg-[var(--surface-secondary)]'
                }`}
              />
            ))}
          </div>

          {/* Error / Status */}
          <div className="mb-4 min-h-9">
            {isVerifying ? (
              <p className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-2 text-center text-[11px] font-bold text-[var(--primary-hover)]">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                Memverifikasi PIN...
              </p>
            ) : errorMessage ? (
              <p
                role="alert"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-center text-[11px] font-bold text-[var(--primary-text)]"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errorMessage}
              </p>
            ) : (
              <p className="text-center text-[11px] font-semibold text-[var(--text-tertiary)]">
                Masukkan 6 digit PIN untuk masuk.
              </p>
            )}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                disabled={isVerifying}
                className="h-12 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] text-lg font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] active:bg-[var(--primary)] active:text-white disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { resetEntry(); setErrorMessage(''); }}
              disabled={isVerifying}
              className="h-12 rounded-2xl bg-[var(--surface-secondary)] text-[11px] font-bold text-[var(--text-tertiary)] disabled:opacity-50"
            >
              BERSIHKAN
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={isVerifying}
              className="h-12 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] text-lg font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] active:bg-[var(--primary)] active:text-white disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              aria-label="Hapus digit"
              onClick={() => {
                pinBufferRef.current = pinBufferRef.current.slice(0, -1);
                setPinInput(pinBufferRef.current);
                setErrorMessage('');
              }}
              disabled={isVerifying}
              className="flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white transition hover:bg-[var(--primary-pressed)] disabled:opacity-50"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          {/* Cloud indicator */}
          <div className="mt-4 text-center">
            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${
              useCloud
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${useCloud ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {useCloud ? 'Cloud Auth' : 'Offline Mode'}
            </span>
          </div>

          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-2 text-[11px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              Batal dan kembali
            </button>
          )}
        </section>
      </div>
    </main>
  );
};
