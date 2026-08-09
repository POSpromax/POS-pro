import {
  MenuItem,
  RawMaterial,
  RestaurantTable,
  Branch,
  UserAccount,
  RestaurantProfile,
  AccessControlRule,
  Order,
  Shift,
  CondimentGroup
} from '../types/pos';

export const INITIAL_STAFF: UserAccount[] = [
  { id: 'usr-1', name: 'Gugun (Owner)', pin: '123456', role: 'OWNER', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', branchIds: ['00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000020'], isActive: true, shiftStart: '08:00', shiftEnd: '17:00', workDays: [1, 2, 3, 4, 5, 6] },
  { id: 'usr-2', name: 'Citra (Kasir)', pin: '111111', role: 'KASIR', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', branchIds: ['00000000-0000-4000-a000-000000000010'], isActive: true, shiftStart: '08:00', shiftEnd: '16:00', workDays: [1, 2, 3, 4, 5, 6] },
  { id: 'usr-3', name: 'Budi (Admin)', pin: '222222', role: 'ADMIN', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', branchIds: ['00000000-0000-4000-a000-000000000010'], isActive: true, shiftStart: '08:00', shiftEnd: '17:00', workDays: [1, 2, 3, 4, 5, 6] },
  { id: 'usr-4', name: 'Chef Joko (Dapur)', pin: '333333', role: 'KITCHEN', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', branchIds: ['00000000-0000-4000-a000-000000000010'], isActive: true, shiftStart: '07:00', shiftEnd: '15:00', workDays: [1, 2, 3, 4, 5, 6] }
];

export const INITIAL_BRANCHES: Branch[] = [
  { id: '00000000-0000-4000-a000-000000000010', name: 'Bakso Ujo - Pasirmulya Bogor', code: 'BGR-01', address: 'Jl. Re. Abdullah No.7-9, RT.01/RW.07, Pasirmulya BOGOR BARAT', phone: '089634627808', isMainBranch: true, isHeadquarters: true, managerName: 'Gugun (HO)', gpsLatitude: -6.609013171412514, gpsLongitude: 106.78293233420759, gpsRadiusMeters: 20 },
  { id: '00000000-0000-4000-a000-000000000020', name: 'Bakso Ujo - Pasar Anyar', code: 'BGR-02', address: 'Pasar Anyar, Bogor', phone: '', isMainBranch: false, isHeadquarters: false, managerName: '' }
];

export const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  // BAHAN (Olahan Porsi / Prepared Stock)
  { id: 'raw-b1', name: 'Bakso Daging', unit: 'pcs', stockQuantity: 17698, minStockThreshold: 20, costPerUnit: 1500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b2', name: 'Bakso Isi Daging Sedang', unit: 'pcs', stockQuantity: 10706, minStockThreshold: 5000, costPerUnit: 2500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b3', name: 'BAKSO KEJU', unit: 'pcs', stockQuantity: 23094, minStockThreshold: 10000, costPerUnit: 3000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b4', name: 'Bakso Polos Kecil', unit: 'pcs', stockQuantity: 10158, minStockThreshold: 5000, costPerUnit: 1000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b5', name: 'Bakso Urat', unit: 'pcs', stockQuantity: 14835, minStockThreshold: 15, costPerUnit: 2200, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b6', name: 'Bakso Urat Gimbal', unit: 'pcs', stockQuantity: 68, minStockThreshold: 50, costPerUnit: 3500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b7', name: 'Bakso Urat Jumbo', unit: 'pcs', stockQuantity: 954, minStockThreshold: 100, costPerUnit: 8500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-b8', name: 'Mie Ayam', unit: 'pcs', stockQuantity: 7719, minStockThreshold: 10, costPerUnit: 4000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },

  // DAPUR (Bahan Baku Mentah & Bumbu)
  { id: 'raw-d1', name: 'Beras', unit: 'kg', stockQuantity: 5, minStockThreshold: 5, costPerUnit: 14000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d2', name: 'Keju', unit: 'pcs', stockQuantity: 6, minStockThreshold: 10, costPerUnit: 25000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d3', name: 'Minyak', unit: 'pcs', stockQuantity: 2, minStockThreshold: 10, costPerUnit: 18000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d4', name: 'Rumput Laut', unit: 'pcs', stockQuantity: 5, minStockThreshold: 10, costPerUnit: 15000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d5', name: 'Skm', unit: 'pcs', stockQuantity: 3, minStockThreshold: 10, costPerUnit: 12000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d6', name: 'Skm Coklat', unit: 'pcs', stockQuantity: 2, minStockThreshold: 10, costPerUnit: 12500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d7', name: 'Sunlight', unit: 'pcs', stockQuantity: 4, minStockThreshold: 10, costPerUnit: 15000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d8', name: 'Susu Skm', unit: 'pcs', stockQuantity: 5, minStockThreshold: 10, costPerUnit: 12000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d9', name: 'Terigu', unit: 'pcs', stockQuantity: 2, minStockThreshold: 10, costPerUnit: 11000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d10', name: 'Tiga Sapi', unit: 'pcs', stockQuantity: 4, minStockThreshold: 10, costPerUnit: 13000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d11', name: 'Bihun', unit: 'pcs', stockQuantity: 45, minStockThreshold: 10, costPerUnit: 5000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d12', name: 'gula', unit: 'pcs', stockQuantity: 29, minStockThreshold: 10, costPerUnit: 17000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d13', name: 'KECAP', unit: 'pack', stockQuantity: 29, minStockThreshold: 5, costPerUnit: 22000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d14', name: 'Mie', unit: 'pcs', stockQuantity: 40, minStockThreshold: 10, costPerUnit: 4500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d15', name: 'Mozza', unit: 'pcs', stockQuantity: 22, minStockThreshold: 10, costPerUnit: 45000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d16', name: 'Mutiara', unit: 'pcs', stockQuantity: 125, minStockThreshold: 10, costPerUnit: 8000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d17', name: 'Nata D Coco', unit: 'pcs', stockQuantity: 48, minStockThreshold: 10, costPerUnit: 14000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d18', name: 'Nutrijel', unit: 'pcs', stockQuantity: 23, minStockThreshold: 10, costPerUnit: 4500, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d19', name: 'Sagu Tani', unit: 'pcs', stockQuantity: 23, minStockThreshold: 10, costPerUnit: 16000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d20', name: 'Sasa', unit: 'pcs', stockQuantity: 16, minStockThreshold: 10, costPerUnit: 6000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d21', name: 'Saus Cabe', unit: 'pcs', stockQuantity: 71, minStockThreshold: 10, costPerUnit: 15000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d22', name: 'SAUS TOMAT', unit: 'pack', stockQuantity: 66, minStockThreshold: 10, costPerUnit: 15000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d23', name: 'Swallow', unit: 'pcs', stockQuantity: 12, minStockThreshold: 10, costPerUnit: 5000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d24', name: 'Teh Bendera', unit: 'pack', stockQuantity: 39, minStockThreshold: 10, costPerUnit: 8000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' },
  { id: 'raw-d25', name: 'Tepung Beras', unit: 'pcs', stockQuantity: 30, minStockThreshold: 10, costPerUnit: 12000, branchId: '00000000-0000-4000-a000-000000000010', branchName: 'Pasirmulya Bogor' }
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  // BAKSO
  {
    id: 'menu-1',
    name: 'Bakso Jumbo Urat Gimbal',
    category: 'BAKSO',
    price: 40000,
    stockCount: 673,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80',
    description: 'Bakso urat jumbo kenyal padat dengan tetelan gimbal garing renyah.',
    hppCost: 18500,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-1', rawMaterialName: 'Daging Sapi Urat', amountNeeded: 0.12, unit: 'kg' },
      { rawMaterialId: 'raw-3', rawMaterialName: 'Tepung Tapioka Super', amountNeeded: 0.03, unit: 'kg' },
      { rawMaterialId: 'raw-7', rawMaterialName: 'Tetelan & Tulang Rangu', amountNeeded: 0.05, unit: 'kg' }
    ]
  },
  {
    id: 'menu-2',
    name: 'Bakso Keju Komplit',
    category: 'BAKSO',
    price: 28000,
    stockCount: 625,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80',
    description: 'Bakso daging sapi isi keju lumer melimpah dengan bihun dan pangsit.',
    hppCost: 11200,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-2', rawMaterialName: 'Daging Sapi Halus', amountNeeded: 0.08, unit: 'kg' },
      { rawMaterialId: 'raw-5', rawMaterialName: 'Keju Mozzarella', amountNeeded: 0.025, unit: 'kg' }
    ]
  },
  {
    id: 'menu-3',
    name: 'Bakso Komplit',
    category: 'BAKSO',
    price: 25000,
    stockCount: 625,
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop&q=80',
    description: 'Bakso urat sedang, bakso halus, tahu bakso, bihun & kuah kaldu segar.',
    hppCost: 9800,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-1', rawMaterialName: 'Daging Sapi Urat', amountNeeded: 0.05, unit: 'kg' },
      { rawMaterialId: 'raw-2', rawMaterialName: 'Daging Sapi Halus', amountNeeded: 0.04, unit: 'kg' }
    ]
  },
  {
    id: 'menu-4',
    name: 'Bakso Komplit + TTLN & T.RANGU',
    category: 'BAKSO',
    price: 35000,
    stockCount: 9266,
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&auto=format&fit=crop&q=80',
    description: 'Porsi bakso komplit melimpah topping tetelan empuk dan tulang rangu rangu.',
    hppCost: 15400,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-1', rawMaterialName: 'Daging Sapi Urat', amountNeeded: 0.06, unit: 'kg' },
      { rawMaterialId: 'raw-7', rawMaterialName: 'Tetelan & Tulang Rangu', amountNeeded: 0.08, unit: 'kg' }
    ]
  },
  {
    id: 'menu-5',
    name: 'Bakso Polos',
    category: 'BAKSO',
    price: 15000,
    stockCount: 2172,
    image: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&auto=format&fit=crop&q=80',
    description: '5 butir bakso halus kecil dalam mangkuk kuah rempah original.',
    hppCost: 6100,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-2', rawMaterialName: 'Daging Sapi Halus', amountNeeded: 0.05, unit: 'kg' }
    ]
  },
  {
    id: 'menu-6',
    name: 'Bakso Telur Komplit',
    category: 'BAKSO',
    price: 25000,
    stockCount: 8807,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80',
    description: 'Bakso besar berisi telur utuh matang sempurna plus 2 bakso kecil.',
    hppCost: 10500,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-2', rawMaterialName: 'Daging Sapi Halus', amountNeeded: 0.06, unit: 'kg' },
      { rawMaterialId: 'raw-4', rawMaterialName: 'Telur Ayam Broiler', amountNeeded: 1, unit: 'pcs' }
    ]
  },
  {
    id: 'menu-7',
    name: 'Bakso Urat Gimbal',
    category: 'BAKSO',
    price: 25000,
    stockCount: 125,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80',
    description: 'Bakso urat bertekstur kasar gurih dilengkapi gorengan gimbal renyah.',
    hppCost: 10100,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-1', rawMaterialName: 'Daging Sapi Urat', amountNeeded: 0.07, unit: 'kg' }
    ]
  },

  // MIE AYAM
  {
    id: 'menu-8',
    name: 'Mie Ayam',
    category: 'MIE AYAM',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&auto=format&fit=crop&q=80',
    description: 'Mie telur kenyal disajikan dengan topping olahan ayam kecap manis gurih.',
    hppCost: 5500,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-6', rawMaterialName: 'Mie Basah Telur', amountNeeded: 0.12, unit: 'kg' },
      { rawMaterialId: 'raw-8', rawMaterialName: 'Ayam Fillet Pejantan', amountNeeded: 0.05, unit: 'kg' }
    ]
  },
  {
    id: 'menu-9',
    name: 'Mie Ayam Bakso Isi Daging',
    category: 'MIE AYAM',
    price: 25000,
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80',
    description: 'Mie ayam lezat ditambah bakso besar berisi cincangan daging sapi.',
    hppCost: 8900,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-6', rawMaterialName: 'Mie Basah Telur', amountNeeded: 0.12, unit: 'kg' },
      { rawMaterialId: 'raw-8', rawMaterialName: 'Ayam Fillet Pejantan', amountNeeded: 0.05, unit: 'kg' },
      { rawMaterialId: 'raw-2', rawMaterialName: 'Daging Sapi Halus', amountNeeded: 0.04, unit: 'kg' }
    ]
  },
  {
    id: 'menu-10',
    name: 'Mie Ayam Bakso Polos',
    category: 'MIE AYAM',
    price: 20000,
    image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&auto=format&fit=crop&q=80',
    description: 'Mie ayam komplit dengan 2 butir bakso sapi halus.',
    hppCost: 7100,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-6', rawMaterialName: 'Mie Basah Telur', amountNeeded: 0.12, unit: 'kg' },
      { rawMaterialId: 'raw-8', rawMaterialName: 'Ayam Fillet Pejantan', amountNeeded: 0.05, unit: 'kg' }
    ]
  },
  {
    id: 'menu-10b',
    name: 'Mie Ayam Bakso Urat Gimbal',
    category: 'MIE AYAM',
    price: 25000,
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80',
    description: 'Mie ayam gurih disajikan dengan bakso urat dan gimbal kriuk.',
    hppCost: 9200,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-6', rawMaterialName: 'Mie Basah Telur', amountNeeded: 0.12, unit: 'kg' },
      { rawMaterialId: 'raw-1', rawMaterialName: 'Daging Sapi Urat', amountNeeded: 0.05, unit: 'kg' }
    ]
  },

  // MAKANAN
  {
    id: 'menu-11',
    name: 'Ayam Goreng Serundeng',
    category: 'MAKANAN',
    price: 30000,
    stockCount: 9820,
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop&q=80',
    description: 'Ayam goreng rempah khas diselimuti serundeng kelapa wangi gurih.',
    hppCost: 11000,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-8', rawMaterialName: 'Ayam Fillet Pejantan', amountNeeded: 0.25, unit: 'kg' }
    ]
  },
  {
    id: 'menu-14',
    name: 'Cireng Ayam Original',
    category: 'MAKANAN',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80',
    description: 'Cireng renyah kenyal gurih isi olahan ayam original kecap manis.',
    hppCost: 6000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-15',
    name: 'Cireng Ayam Pedas',
    category: 'MAKANAN',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80',
    description: 'Cireng renyah kenyal dengan isian ayam suwir pedas mercon.',
    hppCost: 6000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-16',
    name: 'Cireng Keju',
    category: 'MAKANAN',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80',
    description: 'Cireng crispy hangat berisi lelehan keju mozzarella gurih.',
    hppCost: 6500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-17',
    name: 'Risoles',
    category: 'MAKANAN',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80',
    description: 'Risoles mayo garing renyah dengan isian smoked beef & telur.',
    hppCost: 6000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-18',
    name: 'Siomay',
    category: 'MAKANAN',
    price: 25000,
    image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&auto=format&fit=crop&q=80',
    description: 'Siomay ikan tenggiri lembut gurih disiram bumbu kacang kental mantap.',
    hppCost: 9000,
    isAvailable: true,
    ingredients: []
  },

  // TAMBAHAN
  {
    id: 'menu-19',
    name: 'Es Krim 3k',
    category: 'TAMBAHAN',
    price: 3000,
    stockCount: 610,
    image: 'https://images.unsplash.com/photo-1560008511-11c63416e52d?w=400&auto=format&fit=crop&q=80',
    description: 'Es krim cup dingin manis pelengkap sehabis makan bakso.',
    hppCost: 1200,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-20',
    name: 'MENU TAMBAHAN LAINYA',
    category: 'TAMBAHAN',
    price: 0,
    stockCount: 9998,
    image: 'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?w=400&auto=format&fit=crop&q=80',
    description: 'Input harga & keterangan manual untuk permintaan khusus.',
    hppCost: 0,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-21',
    name: 'Nasi',
    category: 'TAMBAHAN',
    price: 7000,
    image: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&auto=format&fit=crop&q=80',
    description: 'Porsi nasi putih hangat pulen wangi.',
    hppCost: 2000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-22',
    name: 'Sukro',
    category: 'TAMBAHAN',
    price: 4000,
    stockCount: 906,
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    description: 'Kacang sukro renyah gurih taburan bakso.',
    hppCost: 1500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-23',
    name: 'Tetelan',
    category: 'TAMBAHAN',
    price: 10000,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80',
    description: 'Extra porsi tetelan sapi empuk juicy.',
    hppCost: 4500,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-7', rawMaterialName: 'Tetelan & Tulang Rangu', amountNeeded: 0.05, unit: 'kg' }
    ]
  },
  {
    id: 'menu-24',
    name: 'Tulang Rangu',
    category: 'TAMBAHAN',
    price: 10000,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80',
    description: 'Extra porsi tulang rangu sapi renyah gurih.',
    hppCost: 4500,
    isAvailable: true,
    ingredients: [
      { rawMaterialId: 'raw-7', rawMaterialName: 'Tetelan & Tulang Rangu', amountNeeded: 0.05, unit: 'kg' }
    ]
  },

  // KRIUK
  {
    id: 'menu-25',
    name: 'Kerupuk Kaleng',
    category: 'KRIUK',
    price: 2000,
    stockCount: 7427,
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    description: 'Kerupuk putih kaleng tradisional garing renyah.',
    hppCost: 600,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-26',
    name: 'Kerupuk Kulit',
    category: 'KRIUK',
    price: 8000,
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    description: 'Kerupuk kulit sapi asli (dorokdok) gurih renyah.',
    hppCost: 3000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-27',
    name: 'Krupuk 6K',
    category: 'KRIUK',
    price: 6000,
    stockCount: 451,
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    description: 'Aneka krupuk varian bungkus sedang 6.000.',
    hppCost: 2500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-28',
    name: 'Pangsit',
    category: 'KRIUK',
    price: 3000,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80',
    description: 'Pangsit goreng garing renyah krispi.',
    hppCost: 1000,
    isAvailable: true,
    ingredients: []
  },

  // MINUMAN
  {
    id: 'menu-29',
    name: 'Air Mineral',
    category: 'MINUMAN',
    price: 5000,
    stockCount: 2192,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80',
    description: 'Air mineral kemasan botol dingin / suhu ruang.',
    hppCost: 1800,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-30',
    name: 'Cendol Durian',
    category: 'MINUMAN',
    price: 28000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es cendol pandan asli dengan santan gurih, gula aren & toping durian monthong.',
    hppCost: 10500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-31',
    name: 'Cendol Nangka',
    category: 'MINUMAN',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es cendol tradisional wangi nangka manis.',
    hppCost: 6500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-32',
    name: 'Cendol Nangka Alpukat',
    category: 'MINUMAN',
    price: 20000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es cendol kombinasi potongan nangka dan alpukat mentega creamy.',
    hppCost: 7500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-33',
    name: 'Cendol Ori',
    category: 'MINUMAN',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es cendol original gula jawa segar.',
    hppCost: 5000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-34',
    name: 'Es Alpukat Kelapa',
    category: 'MINUMAN',
    price: 17000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Minuman alpukat kocok dengan kerokan kelapa muda segar.',
    hppCost: 6200,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-35',
    name: 'es batu',
    category: 'MINUMAN',
    price: 2000,
    image: 'https://images.unsplash.com/photo-1517420879524-86d64ac2f339?w=400&auto=format&fit=crop&q=80',
    description: 'Gelas es batu kristal bersih hygiene.',
    hppCost: 300,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-13',
    name: 'Es Teler Durian',
    category: 'MINUMAN',
    price: 35000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es teler segar kaya kelapa muda, alpukat, nangka dan topping durian utuh.',
    hppCost: 12000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-36',
    name: 'Es Teler Kuah Alpukat',
    category: 'MINUMAN',
    price: 25000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es teler dengan kuah kental jus alpukat asli.',
    hppCost: 8500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-37',
    name: 'Es Teler Original',
    category: 'MINUMAN',
    price: 20000,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&auto=format&fit=crop&q=80',
    description: 'Es teler racikan khas alpukat, nangka, kelapa muda dan susu.',
    hppCost: 7000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-38',
    name: 'Jeruk Hot / Ice',
    category: 'MINUMAN',
    price: 10000,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=80',
    description: 'Perasan jeruk peras murni hangat atau pakai es.',
    hppCost: 3500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-39',
    name: 'Jus Alpukat Jumbo',
    category: 'MINUMAN',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus alpukat mentega gelas jumbo disiram cokelat manis.',
    hppCost: 6500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-40',
    name: 'Jus Jambu Jumbo',
    category: 'MINUMAN',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus jambu biji merah segar kaya vitamin C.',
    hppCost: 5000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-41',
    name: 'Jus Mangga Jumbo',
    category: 'MINUMAN',
    price: 15000,
    stockCount: 2614,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus mangga harum manis segar jumbo.',
    hppCost: 5000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-42',
    name: 'Jus Melon Jumbo',
    category: 'MINUMAN',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus melon manis dingin segar porsi besar.',
    hppCost: 5000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-43',
    name: 'Jus Nanas Jumbo',
    category: 'MINUMAN',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus nanas murni asam manis menyegarkan.',
    hppCost: 5000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-44',
    name: 'Jus Nanas Timun',
    category: 'MINUMAN',
    price: 18000,
    stockCount: 18,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Kombinasi jus nanas & timun peleram dahaga.',
    hppCost: 6000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-45',
    name: 'Jus Sirsak Jumbo',
    category: 'MINUMAN',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus sirsak murni kental manis asam nikmat.',
    hppCost: 5000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-46',
    name: 'Jus Stroberry Jumbo',
    category: 'MINUMAN',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80',
    description: 'Jus stroberi merah segar manis mantap.',
    hppCost: 5500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-47',
    name: 'Teh Botol',
    category: 'MINUMAN',
    price: 7000,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80',
    description: 'Teh botol Sosro dingin segar.',
    hppCost: 3500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-12',
    name: 'Teh Manis ICE/HOT',
    category: 'MINUMAN',
    price: 7000,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80',
    description: 'Es teh manis segar diseduh dari daun teh wangi melati pilihan.',
    hppCost: 1500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-48',
    name: 'Teh Tawar HOT',
    category: 'MINUMAN',
    price: 2000,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80',
    description: 'Teh tawar hangat harum melati.',
    hppCost: 500,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-49',
    name: 'Teh Tawar Ice',
    category: 'MINUMAN',
    price: 3000,
    stockCount: 699,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80',
    description: 'Es teh tawar dingin segar.',
    hppCost: 700,
    isAvailable: true,
    ingredients: []
  },

  // BUNDLING
  {
    id: 'menu-50',
    name: 'Paket Hemat Bakso + Teh Manis',
    category: 'BUNDLING',
    price: 30000,
    stockCount: 100,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80',
    description: 'Paket spesial Bakso Komplit plus Es Teh Manis segar.',
    hppCost: 11000,
    isAvailable: true,
    ingredients: []
  },
  {
    id: 'menu-51',
    name: 'Paket Kenyang Mie Ayam + Es Teler',
    category: 'BUNDLING',
    price: 32000,
    stockCount: 100,
    image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&auto=format&fit=crop&q=80',
    description: 'Paket lezat Mie Ayam Bakso Polos plus Es Teler Original.',
    hppCost: 13000,
    isAvailable: true,
    ingredients: []
  }
];

export const INITIAL_CONDIMENT_GROUPS: CondimentGroup[] = [
  {
    id: 'cg-1',
    name: 'Kuah',
    mode: 'ADD_ON',
    required: true,
    minSelect: 1,
    maxSelect: 1,
    targetCategories: ['BAKSO'],
    isActive: true,
    options: [
      { id: 'opt-101', name: 'ORIGINAL', price: 0, isAvailable: true },
      { id: 'opt-102', name: 'PEDAS TAICHAN', price: 3000, isAvailable: true },
      { id: 'opt-103', name: 'KUAH KALDU GURIH', price: 0, isAvailable: true }
    ]
  },
  {
    id: 'cg-2',
    name: 'ISIAN',
    mode: 'ADD_ON',
    required: false,
    minSelect: 0,
    maxSelect: 7,
    targetCategories: ['BAKSO', 'MIE AYAM'],
    isActive: true,
    options: [
      { id: 'opt-201', name: 'MIE', price: 0, isAvailable: true },
      { id: 'opt-202', name: 'BIHUN', price: 0, isAvailable: true },
      { id: 'opt-203', name: 'KWETIAW', price: 0, isAvailable: true },
      { id: 'opt-204', name: 'SAWI', price: 0, isAvailable: true },
      { id: 'opt-205', name: 'TAUGE', price: 0, isAvailable: true },
      { id: 'opt-206', name: 'BAWANG', price: 0, isAvailable: true },
      { id: 'opt-207', name: 'SLEDRI', price: 0, isAvailable: true }
    ]
  },
  {
    id: 'cg-3',
    name: 'TEH MANIS',
    mode: 'PAKET',
    required: false,
    minSelect: 0,
    maxSelect: 1,
    targetCategories: ['MINUMAN', 'BUNDLING'],
    isActive: true,
    options: [
      { id: 'opt-301', name: 'ES TEH MANIS', price: 0, isAvailable: true },
      { id: 'opt-302', name: 'TEH MANIS HANGAT', price: 0, isAvailable: true }
    ]
  },
  {
    id: 'cg-4',
    name: 'AIR MINERAL',
    mode: 'ADD_ON',
    required: false,
    minSelect: 0,
    maxSelect: 1,
    targetCategories: ['MINUMAN'],
    isActive: true,
    options: [
      { id: 'opt-401', name: 'DINGIN', price: 0, isAvailable: true },
      { id: 'opt-402', name: 'REGULER', price: 0, isAvailable: true }
    ]
  },
  {
    id: 'cg-5',
    name: 'Tambahan',
    mode: 'ADD_ON',
    required: false,
    minSelect: 0,
    maxSelect: 5,
    targetCategories: ['ALL'],
    isActive: true,
    options: [
      { id: 'opt-501', name: 'KERUPUK KALEK', price: 2000, isAvailable: true },
      { id: 'opt-502', name: 'EXTRA TETELAN', price: 10000, isAvailable: true }
    ]
  }
];

export const INITIAL_TABLES: RestaurantTable[] = [
  { id: 'tbl-1', number: '1', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-2', number: '2', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-3', number: '3', capacity: 2, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-4', number: '4', capacity: 6, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-5', number: '5', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-6', number: '6', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-7', number: '7', capacity: 2, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-8', number: '8', capacity: 6, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-9', number: '9', capacity: 8, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-10', number: '10', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-11', number: '11', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' },
  { id: 'tbl-12', number: '12', capacity: 4, status: 'FREE', isSelfOrderEnabled: true, branchId: '00000000-0000-4000-a000-000000000010' }
];

export const INITIAL_RESTAURANT_PROFILE: RestaurantProfile = {
  name: 'BAKSO UJO',
  tagline: 'Nikmati Bakso Legendaris Sejak 2025',
  address: 'Jl. Re. Abdullah No.7-9, RT.01/RW.07, Pasirmulya BOGOR BARAT',
  phone: '6289634627808',
  instagram: 'baksoujo__',
  tiktok: 'baksoujo',
  logoUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&auto=format&fit=crop&q=80',
  
  // Landing Page Config
  promoBannerTitle: 'FREE ICE CREAM ATAU ES TEH MANIS',
  promoBannerDescription: 'TUNJUKAN REVIEW GMAPS DIKASIR',
  wallpaperBackgroundUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop',
  googleReviewUrl: 'https://www.google.com/search?q=bakso+ujo+bogor',
  googleReviewText: 'Bagikan pengalaman makanmu disini',

  // Dapur & KDS Config
  orderTimeLimitMinutes: 5,
  soundNotificationsEnabled: true,
  soundOrderBaru: 'High Alarm (Siren)',
  soundPesananMasuk: 'Kitchen Order',
  soundPembayaranSukses: 'Success Chime',
  soundWarning: 'Warning Beep',
  soundHighAlarm: 'Kitchen Buzzer',
  soundCustomerOrder: 'Customer Order',
  runningText: 'JANGAN LUPA SHOLAT',

  // Karyawan & Shift Config
  shiftScheduleKitchen: '07:00',
  shiftScheduleCashier: '08:00',
  shiftScheduleStaff: '09:00',
  shiftScheduleAdmin: '08:00',
  latenessToleranceMinutes: 5,

  // GPS & Absensi Config
  gpsLatitude: -6.609013171412514,
  gpsLongitude: 106.78293233420759,
  gpsRadiusMeters: 20,
  requireSelfiePhoto: true,
  requireGpsActive: true,
  isAttendanceEnabled: true,
  isSelfOrderEnabled: true,
  maxPinAttempts: 5,
  pinLockoutMinutes: 5,

  // Keuangan Config
  taxRatePercent: 10,
  isTaxEnabled: false,
  serviceChargePercent: 0,
  isServiceChargeEnabled: false,
  isManualDiscountEnabled: true,
  roundingMode: 'TERDEKAT',
  isRoundingEnabled: false
};

export const INITIAL_ACCESS_CONTROL: AccessControlRule[] = [
  { role: 'SUPER_OWNER', canAccessPOS: true, canAccessKDS: true, canAccessShift: true, canAccessInventory: true, canAccessAnalytics: true, canAccessSettings: true, canVoidOrder: true },
  { role: 'OWNER', canAccessPOS: true, canAccessKDS: true, canAccessShift: true, canAccessInventory: true, canAccessAnalytics: true, canAccessSettings: true, canVoidOrder: true },
  { role: 'MANAGER', canAccessPOS: true, canAccessKDS: true, canAccessShift: true, canAccessInventory: true, canAccessAnalytics: true, canAccessSettings: false, canVoidOrder: true },
  { role: 'ADMIN', canAccessPOS: true, canAccessKDS: true, canAccessShift: true, canAccessInventory: true, canAccessAnalytics: true, canAccessSettings: true, canVoidOrder: true },
  { role: 'KASIR', canAccessPOS: true, canAccessKDS: true, canAccessShift: true, canAccessInventory: false, canAccessAnalytics: false, canAccessSettings: false, canVoidOrder: false },
  { role: 'KITCHEN', canAccessPOS: false, canAccessKDS: true, canAccessShift: false, canAccessInventory: true, canAccessAnalytics: false, canAccessSettings: false, canVoidOrder: false }
];

export const INITIAL_CURRENT_SHIFT: Shift = {
  id: 'shf-101',
  staffId: 'usr-2',
  staffName: 'CITRA',
  staffRole: 'KASIR',
  startTime: '2026-08-05T08:00:00.000Z',
  initialCash: 500000,
  grossOmset: 2892000,
  cashSales: 1573000,
  nonCashSales: 1319000,
  totalExpense: 153000,
  totalIncome: 0,
  status: 'OPEN',
  notes: 'Shift Pagi Kasir Utama',
  branchId: '00000000-0000-4000-a000-000000000010',
  branchName: 'Bakso Ujo - Pasirmulya Bogor',
  scheduledStart: '08:00',
  scheduledEnd: '16:00'
};

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-038',
    orderNumber: '#038',
    customerName: 'Guest',
    tableNumber: '01',
    type: 'DINE_IN',
    items: [
      { id: 'itm-1', menuId: 'menu-1', menuName: 'Bakso Jumbo Urat Gimbal', price: 40000, quantity: 1, category: 'BAKSO' },
      { id: 'itm-2', menuId: 'menu-12', menuName: 'Teh Manis ICE/HOT', price: 5000, quantity: 2, category: 'MINUMAN' },
      { id: 'itm-3', menuId: 'menu-13', menuName: 'Es Teler Durian', price: 20000, quantity: 1, category: 'MINUMAN' }
    ],
    subtotal: 63000,
    tax: 0,
    discount: 0,
    total: 63000,
    paymentMethod: 'QRIS',
    paymentStatus: 'PAID',
    cashPaid: 63000,
    change: 0,
    status: 'NEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    shiftId: 'shf-101',
    branchId: '00000000-0000-4000-a000-000000000010',
    cashierName: 'CITRA',
    syncStatus: 'SYNCED'
  },
  {
    id: 'ord-037',
    orderNumber: '#037',
    customerName: 'Guest',
    tableNumber: '02',
    type: 'DINE_IN',
    items: [
      { id: 'itm-4', menuId: 'menu-4', menuName: 'Bakso Komplit + TTLN & T.RANGU', price: 35000, quantity: 1, category: 'BAKSO' },
      { id: 'itm-5', menuId: 'menu-5', menuName: 'Bakso Polos', price: 15000, quantity: 1, category: 'BAKSO' }
    ],
    subtotal: 50000,
    tax: 0,
    discount: 0,
    total: 50000,
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    cashPaid: 100000,
    change: 50000,
    status: 'COOKING',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    shiftId: 'shf-101',
    branchId: '00000000-0000-4000-a000-000000000010',
    cashierName: 'CITRA',
    syncStatus: 'SYNCED'
  },
  {
    id: 'ord-036',
    orderNumber: '#036',
    customerName: 'Guest',
    tableNumber: '03',
    type: 'DINE_IN',
    items: [
      { id: 'itm-6', menuId: 'menu-5', menuName: 'Bakso Polos', price: 15000, quantity: 6, category: 'BAKSO' },
      { id: 'itm-7', menuId: 'menu-12', menuName: 'Teh Manis ICE/HOT', price: 5000, quantity: 2, category: 'MINUMAN' },
      { id: 'itm-8', menuId: 'menu-13', menuName: 'Es Teler Durian', price: 20000, quantity: 1, category: 'MINUMAN' },
      { id: 'itm-9', menuId: 'menu-8', menuName: 'Mie Ayam', price: 15000, quantity: 1, category: 'MIE AYAM' }
    ],
    subtotal: 131000,
    tax: 0,
    discount: 0,
    total: 131000,
    paymentMethod: 'QRIS',
    paymentStatus: 'PAID',
    cashPaid: 131000,
    change: 0,
    status: 'COOKING',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    shiftId: 'shf-101',
    branchId: '00000000-0000-4000-a000-000000000010',
    cashierName: 'CITRA',
    syncStatus: 'SYNCED'
  },
  {
    id: 'ord-035',
    orderNumber: '#035',
    customerName: 'Guest',
    tableNumber: '04',
    type: 'DINE_IN',
    items: [
      { id: 'itm-10', menuId: 'menu-3', menuName: 'Bakso Komplit', price: 25000, quantity: 2, category: 'BAKSO' },
      { id: 'itm-11', menuId: 'menu-1', menuName: 'Bakso Jumbo Urat Gimbal', price: 40000, quantity: 1, category: 'BAKSO' },
      { id: 'itm-12', menuId: 'menu-12', menuName: 'Teh Manis ICE/HOT', price: 5000, quantity: 2, category: 'MINUMAN' }
    ],
    subtotal: 100000,
    tax: 0,
    discount: 0,
    total: 100000,
    paymentMethod: 'DEBIT',
    paymentStatus: 'PAID',
    cashPaid: 100000,
    change: 0,
    status: 'READY',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    shiftId: 'shf-101',
    branchId: '00000000-0000-4000-a000-000000000010',
    cashierName: 'CITRA',
    syncStatus: 'SYNCED'
  }
];
