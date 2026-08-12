import React from 'react';
import { X, Smartphone } from 'lucide-react';
import {
  MenuItem,
  Order,
  RestaurantProfile,
  CondimentGroup,
  RestaurantTable,
  Branch
} from '../../types/pos';
import { SelfOrderLandingPage } from './SelfOrderLandingPage';

interface CustomerSelfOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  tables: RestaurantTable[];
  menuItems: MenuItem[];
  profile: RestaurantProfile;
  condimentGroups: CondimentGroup[];
  isSelfOrderSystemEnabled?: boolean;
  orders?: Order[];
  onSubmitCustomerOrder: (order: Order) => void;
  currentBranch: Branch;
  qrToken?: string;
}

export const CustomerSelfOrderModal: React.FC<CustomerSelfOrderModalProps> = ({
  isOpen,
  onClose,
  tableNumber,
  tables,
  menuItems,
  profile,
  condimentGroups,
  isSelfOrderSystemEnabled = true,
  orders = [],
  onSubmitCustomerOrder,
  currentBranch,
  qrToken,
}) => {
  if (!isOpen) return null;

  return (
    <div className="theme-self-order animate-fadeIn fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-600/30 p-0 backdrop-blur-sm md:p-4">
      {/* Modal Shell */}
      <div className="relative flex max-h-screen w-full max-w-[460px] flex-col overflow-hidden bg-white shadow-xl md:max-h-[920px] md:rounded-2xl">
        
        {/* Top Floating Modal Bar for Cashier Control */}
        <div className="z-50 flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-primary)]">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[var(--primary)]" />
            <span className="text-xs font-bold tracking-wide text-[var(--text-primary)]">
              Simulasi Tampilan HP Customer (Meja #{tableNumber})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary-hover)] transition-all hover:bg-[var(--primary-border)]"
            title="Tutup Simulasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Embedded Isolated Mobile Landing Experience */}
        <div className="flex-1 overflow-hidden">
          <SelfOrderLandingPage
            tables={tables}
            menuItems={menuItems}
            profile={profile}
            condimentGroups={condimentGroups}
            isSelfOrderSystemEnabled={isSelfOrderSystemEnabled}
            orders={orders}
            onSubmitCustomerOrder={onSubmitCustomerOrder}
            initialTableNumber={tableNumber || '1'}
            currentBranch={currentBranch}
            qrToken={qrToken}
          />
        </div>

      </div>
    </div>
  );
};
