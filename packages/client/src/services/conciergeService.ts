// ============================================
// NS LUXURY VILLA — Guest Concierge & Room Service Client
// Handles service requests, housekeeping, dining, and villa amenities.
// ============================================

export interface ConciergeCatalogItem {
  id: string;
  category: 'dining' | 'housekeeping' | 'experiences' | 'comfort';
  title: string;
  description: string;
  price: number;
  currency: string;
  estTime: string;
  iconName: string;
  image?: string;
  popular?: boolean;
}

export interface GuestServiceRequest {
  id: string;
  bookingConfirmationNo?: string;
  roomNumber?: string;
  guestName: string;
  category: string;
  title: string;
  details?: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  estimatedArrival?: string;
  totalCost: number;
  currency: string;
}

const REQUESTS_KEY = 'nslv_concierge_requests';

export const CONCIERGE_CATALOG: ConciergeCatalogItem[] = [
  // Dining & Villa Kitchen
  {
    id: 'dining-tilapia',
    category: 'dining',
    title: 'Grilled Fresh Tilapia with Banku',
    description: 'Fresh Volta lake tilapia grilled over charcoal, served with piping hot banku, ground fresh green pepper, and shito.',
    price: 100,
    currency: 'GHS',
    estTime: '30-40 mins',
    iconName: 'UtensilsCrossed',
    popular: true,
  },
  {
    id: 'dining-breakfast',
    category: 'dining',
    title: 'NS Villa English & Tropical Breakfast',
    description: 'Golden fried eggs, sausages, baked beans, toast, fresh papaya & pineapple slices, served with hot beverage.',
    price: 65,
    currency: 'GHS',
    estTime: '20-25 mins',
    iconName: 'Coffee',
    popular: true,
  },
  {
    id: 'dining-redfish',
    category: 'dining',
    title: 'Red Fish with Workple & Pepper',
    description: 'Crisp seasoned red fish served with tender traditional corn workple and authentic Ghanaian hot pepper sauce.',
    price: 80,
    currency: 'GHS',
    estTime: '30 mins',
    iconName: 'UtensilsCrossed',
  },
  {
    id: 'dining-salad',
    category: 'dining',
    title: 'Chef Special Ghanaian Mixed Salad',
    description: 'Hearty villa salad with sardine, macaroni, boiled egg, baked beans, sweet carrots, cucumber, and dressing.',
    price: 70,
    currency: 'GHS',
    estTime: '20 mins',
    iconName: 'Sparkles',
  },
  {
    id: 'dining-cocktails',
    category: 'dining',
    title: 'Villa Sunset Cocktails (Set of 2)',
    description: 'Handcrafted signature tropical rum and fruit cocktails delivered to your terrace or poolside cabana.',
    price: 90,
    currency: 'GHS',
    estTime: '15 mins',
    iconName: 'GlassWater',
    popular: true,
  },
  {
    id: 'dining-champagne',
    category: 'dining',
    title: 'Chilled Champagne & Tropical Fruit',
    description: 'Bottle of premium French champagne on ice accompanied by sliced Volta mango, sweet pineapple, and grapes.',
    price: 420,
    currency: 'GHS',
    estTime: '20 mins',
    iconName: 'Wine',
  },

  // Housekeeping & Linens
  {
    id: 'hk-towels',
    category: 'housekeeping',
    title: 'Extra Plush Cotton Towel Set',
    description: 'Fresh set of Egyptian cotton bath sheets, hand towels, and pool loungers delivered directly to your room.',
    price: 0,
    currency: 'GHS',
    estTime: '15 mins',
    iconName: 'Sparkles',
    popular: true,
  },
  {
    id: 'hk-turndown',
    category: 'housekeeping',
    title: 'Evening Turndown Service',
    description: 'Aromatherapy linen mist, pillow fluffing, mood lighting, and handmade night chocolates.',
    price: 0,
    currency: 'GHS',
    estTime: '18:00 - 21:00',
    iconName: 'Moon',
  },
  {
    id: 'hk-iron',
    category: 'housekeeping',
    title: 'Steam Iron & Ironing Board',
    description: 'Heavy-duty steam iron and ironing board delivered to your room.',
    price: 0,
    currency: 'GHS',
    estTime: '15 mins',
    iconName: 'Shirt',
  },

  // Experiences & Transport
  {
    id: 'exp-airport',
    category: 'experiences',
    title: 'Airport Transfer (Kotoka ACC or Ho HZO)',
    description: 'Private air-conditioned executive vehicle transfer with chilled bottled water and high-speed Wi-Fi onboard.',
    price: 380,
    currency: 'GHS',
    estTime: 'Advance booking',
    iconName: 'Car',
    popular: true,
  },
  {
    id: 'exp-massage',
    category: 'experiences',
    title: 'Terrace Aromatherapy Massage (60m)',
    description: 'Relaxing full-body wellness massage performed on your private shaded villa terrace overlooking Ho.',
    price: 250,
    currency: 'GHS',
    estTime: 'Upon schedule',
    iconName: 'HeartHandshake',
  },

  // Comfort & Assistance
  {
    id: 'comf-pillows',
    category: 'comfort',
    title: 'Pillow Menu Selection',
    description: 'Choice of Memory Foam, Organic Bamboo, Down Feather, or Hypoallergenic contoured pillows.',
    price: 0,
    currency: 'GHS',
    estTime: '20 mins',
    iconName: 'BedDouble',
  },
  {
    id: 'comf-ac-tech',
    category: 'comfort',
    title: 'Climate & Wi-Fi Assistance',
    description: 'On-duty engineering support for AC temperature calibration or dedicated high-speed Wi-Fi setup.',
    price: 0,
    currency: 'GHS',
    estTime: '15 mins',
    iconName: 'ThermometerSnowflake',
  },
];

class ConciergeService {
  private requests: GuestServiceRequest[] = [];
  private listeners: Set<(reqs: GuestServiceRequest[]) => void> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(REQUESTS_KEY);
      this.requests = raw ? JSON.parse(raw) : [];
    } catch {
      this.requests = [];
    }
  }

  private save() {
    try {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(this.requests));
    } catch {
      // Ignore
    }
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.requests]);
    }
  }

  public subscribe(listener: (reqs: GuestServiceRequest[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.requests]);
    return () => this.listeners.delete(listener);
  }

  public getRequests(): GuestServiceRequest[] {
    return [...this.requests];
  }

  public createRequest(data: {
    title: string;
    category: string;
    guestName: string;
    roomNumber?: string;
    bookingConfirmationNo?: string;
    details?: string;
    totalCost: number;
    currency: string;
  }): GuestServiceRequest {
    const req: GuestServiceRequest = {
      id: `svc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      estimatedArrival: '15-30 mins',
      ...data,
    };
    this.requests.unshift(req);
    this.save();

    setTimeout(() => {
      this.updateStatus(req.id, 'ACCEPTED');
    }, 12000);

    return req;
  }

  public updateStatus(id: string, status: GuestServiceRequest['status']) {
    this.requests = this.requests.map((r) => (r.id === id ? { ...r, status } : r));
    this.save();
  }

  public cancelRequest(id: string) {
    this.requests = this.requests.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r));
    this.save();
  }
}

export const conciergeService = new ConciergeService();
