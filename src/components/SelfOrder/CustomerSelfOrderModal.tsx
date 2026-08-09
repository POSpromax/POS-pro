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
  currentBranch
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4 overflow-y-auto animate-fadeIn">
      {/* Modal Shell */}
      <div className="relative w-full max-w-[460px] bg-slate-900 md:rounded-[48px] shadow-2xl flex flex-col max-h-screen md:max-h-[920px] overflow-hidden">
        
        {/* Top Floating Modal Bar for Cashier Control */}
        <div className="bg-slate-900 text-white px-4 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-black tracking-wide text-slate-200">
              Simulasi Tampilan HP Customer (Meja #{tableNumber})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
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
          />
        </div>

      </div>
    </div>
  );
};
