import React, { useState } from 'react';
import { Building2, Delete, KeyRound, Lock, QrCode, ShieldAlert, ShieldCheck } from 'lucide-react';
import { UserAccount, Branch } from '../../types/pos';
import { INITIAL_BRANCHES } from '../../data/initialData';
import { DBStorage } from '../../services/dbStorage';

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: UserAccount, selectedBranch?: Branch) => void;
  activeUser: UserAccount;
  branches?: Branch[];
  currentBranch?: Branch;
  onSelectBranch?: (branch: Branch) => void;
  onOpenSelfOrderDemo?: () => void;
  staffAccounts: UserAccount[];
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  branches = INITIAL_BRANCHES,
  currentBranch = INITIAL_BRANCHES[0],
  onSelectBranch,
  onOpenSelfOrderDemo,
  staffAccounts
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranch.id);
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const activeBranch = branches.find((branch) => branch.id === selectedBranchId) || currentBranch;
  const eligibleStaff = staffAccounts.filter(
    (staff) => staff.isActive !== false && (!staff.branchIds?.length || staff.branchIds.includes(selectedBranchId))
  );

  const finishVerification = (pin: string) => {
    setIsVerifying(true);
    const result = DBStorage.authenticateByPin(selectedBranchId, pin);
    if (result.success && result.user) {
      onSelectBranch?.(activeBranch);
      onSuccessLogin(result.user, activeBranch);
      setPinInput('');
      setErrorMessage('');
      setIsVerifying(false);
      onClose();
      return;
    }

    const attempts = result.remainingAttempts !== undefined ? ` Sisa percobaan: ${result.remainingAttempts}.` : '';
    setErrorMessage(`${result.message}${attempts}`);
    setPinInput('');
    setIsVerifying(false);
  };

  const evaluatePin = (nextPin: string) => {
    setPinInput(nextPin);
    setErrorMessage('');

    const exactMatch = eligibleStaff.some((staff) => staff.pin === nextPin);
    if (exactMatch) {
      finishVerification(nextPin);
      return;
    }

    if (nextPin.length >= 4) {
      const canContinue = eligibleStaff.some(
        (staff) => staff.pin.length > nextPin.length && staff.pin.startsWith(nextPin)
      );
      if (!canContinue || nextPin.length === 6) finishVerification(nextPin);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (isVerifying || pinInput.length >= 6) return;
    evaluatePin(pinInput + digit);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12110F]/85 p-4 font-sans backdrop-blur-md select-none animate-fadeIn">
      <div className="grid w-full max-w-[760px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between bg-[#1A1917] p-7 text-white">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F05A1F] shadow-lg shadow-orange-950/30">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F7A47D]">Secure terminal</p>
                <h2 className="text-lg font-black tracking-tight">Masuk dengan PIN</h2>
              </div>
            </div>

            <label className="block rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/55">
                <Building2 className="h-3.5 w-3.5 text-[#F05A1F]" /> Outlet terminal
              </span>
              <select
                aria-label="Outlet terminal"
                value={selectedBranchId}
                onChange={(event) => {
                  const branchId = event.target.value;
                  setSelectedBranchId(branchId);
                  const branch = branches.find((item) => item.id === branchId);
                  if (branch) onSelectBranch?.(branch);
                  setPinInput('');
                  setErrorMessage('');
                }}
                className="w-full cursor-pointer rounded-xl border border-white/10 bg-[#292724] px-3 py-2.5 text-xs font-bold text-white outline-none"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}{branch.isMainBranch ? ' · Pusat' : ''}</option>
                ))}
              </select>
            </label>

            <div className="mt-5 space-y-3">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F05A1F]" />
                <div>
                  <p className="text-xs font-bold">Akses otomatis berdasarkan PIN</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/50">Sistem mengenali akun, role, dan menu yang diizinkan tanpa menampilkan daftar petugas.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#F05A1F]" />
                <div>
                  <p className="text-xs font-bold">PIN bersifat pribadi</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/50">Jangan berbagi PIN. Terminal akan terkunci sementara setelah beberapa percobaan gagal.</p>
                </div>
              </div>
            </div>
          </div>

          {onOpenSelfOrderDemo && (
            <button
              type="button"
              onClick={() => { onClose(); onOpenSelfOrderDemo(); }}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
            >
              <QrCode className="h-4 w-4 text-[#F05A1F]" /> Buka simulasi self-order
            </button>
          )}
        </section>

        <section className="p-7 md:p-8">
          <div className="mb-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#99928C]">{activeBranch.code || 'OUTLET'}</p>
            <h3 className="mt-1 text-xl font-black text-[#1A1714]">Masukkan PIN Petugas</h3>
            <p className="mt-1 text-[11px] font-medium text-[#918A84]">Role dan halaman awal akan ditentukan otomatis.</p>
          </div>

          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="PIN petugas"
            value={pinInput}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '').slice(0, 6);
              if (!isVerifying) evaluatePin(value);
            }}
            className="sr-only"
          />

          <div className="mb-5 flex h-8 items-center justify-center gap-2.5" aria-label={`${pinInput.length} digit PIN terisi`}>
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${index < pinInput.length ? 'scale-110 border-[#F05A1F] bg-[#F05A1F]' : 'border-[#D8D4D0] bg-[#F5F3F1]'}`} />
            ))}
          </div>

          <div className="mb-4 min-h-9">
            {errorMessage ? (
              <p role="alert" className="flex items-center justify-center gap-1.5 rounded-xl border border-[#F4C7B4] bg-[#FFF3ED] px-3 py-2 text-center text-[10px] font-bold text-[#C84412]">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errorMessage}
              </p>
            ) : (
              <p className="text-center text-[10px] font-semibold text-[#AAA39D]">Masuk otomatis setelah PIN dikenali.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button key={digit} type="button" onClick={() => handleKeyPress(digit)} className="h-12 rounded-2xl border border-[#E7E2DE] bg-[#F8F7F5] text-lg font-black text-[#1A1714] transition hover:border-[#F3B393] hover:bg-[#FFF4EE] active:bg-[#F05A1F] active:text-white">{digit}</button>
            ))}
            <button type="button" onClick={() => { setPinInput(''); setErrorMessage(''); }} className="h-12 rounded-2xl bg-[#F2F0EE] text-[9px] font-black text-[#77706A]">BERSIHKAN</button>
            <button type="button" onClick={() => handleKeyPress('0')} className="h-12 rounded-2xl border border-[#E7E2DE] bg-[#F8F7F5] text-lg font-black text-[#1A1714] transition hover:border-[#F3B393] hover:bg-[#FFF4EE] active:bg-[#F05A1F] active:text-white">0</button>
            <button type="button" aria-label="Hapus digit" onClick={() => { setPinInput((value) => value.slice(0, -1)); setErrorMessage(''); }} className="flex h-12 items-center justify-center rounded-2xl bg-[#1A1917] text-white transition hover:bg-black"><Delete className="h-4 w-4" /></button>
          </div>

          <button type="button" onClick={onClose} className="mt-5 w-full py-2 text-[10px] font-bold text-[#918A84] hover:text-[#1A1714]">Batal dan kembali</button>
        </section>
      </div>
    </div>
  );
};
