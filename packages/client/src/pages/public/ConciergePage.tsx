import React, { useEffect, useState } from 'react';
import {
  PhoneCall,
  MessageCircle,
  Clock,
  Sparkles,
  Coffee,
  Wine,
  GlassWater,
  UtensilsCrossed,
  Moon,
  Shirt,
  Car,
  HeartHandshake,
  BedDouble,
  ThermometerSnowflake,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  CONCIERGE_CATALOG,
  conciergeService,
  type ConciergeCatalogItem,
  type GuestServiceRequest,
} from '../../services/conciergeService';
import { villaAssets } from '../../assets';
import { publicApi, type PublicBookingConfig } from '../../services/publicApi';

const iconMap: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Coffee,
  Wine,
  GlassWater,
  UtensilsCrossed,
  Sparkles,
  Moon,
  Shirt,
  Car,
  HeartHandshake,
  BedDouble,
  ThermometerSnowflake,
};

export const ConciergePage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);
  const [selectedItem, setSelectedItem] = useState<ConciergeCatalogItem | null>(null);
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    publicApi.getConfig().then(setConfig).catch(() => null);
    return conciergeService.subscribe(setRequests);
  }, []);

  const filteredItems =
    activeCategory === 'all'
      ? CONCIERGE_CATALOG
      : CONCIERGE_CATALOG.filter((item) => item.category === activeCategory);

  const villaPhone = config?.villa.phone || '+233 535 572 774';
  const villaCleanPhone = villaPhone.replace(/[^0-9+]/g, '');

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);

    try {
      conciergeService.createRequest({
        title: selectedItem.title,
        category: selectedItem.category,
        guestName: guestName || 'Resident Guest',
        roomNumber: roomNumber || 'Direct Inquiry',
        details: notes,
        totalCost: selectedItem.price,
        currency: selectedItem.currency,
      });

      setSuccessMsg(`Requested "${selectedItem.title}" successfully!`);
      setTimeout(() => {
        setSuccessMsg('');
        setSelectedItem(null);
        setNotes('');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: GuestServiceRequest['status']) => {
    switch (status) {
      case 'ACCEPTED':
        return { label: 'Staff Assigned', bg: 'bg-sky-500/15 text-sky-500 border-sky-500/20' };
      case 'IN_PROGRESS':
        return { label: 'In Progress', bg: 'bg-amber-500/15 text-amber-500 border-amber-500/20' };
      case 'COMPLETED':
        return { label: 'Delivered', bg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-rose-500/15 text-rose-500 border-rose-500/20' };
      default:
        return { label: 'Pending Dispatch', bg: 'bg-[var(--ns-gold)]/15 text-[var(--ns-gold)] border-[var(--ns-gold)]/20' };
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
      {/* Concierge Hero with Official Logo */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--ns-glass-line)] bg-gradient-to-br from-[#121c26] to-[#0a1118] p-5 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 bg-[var(--ns-gold)]/15 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={villaAssets.logo}
              alt="NS Luxury Villa Logo"
              className="h-12 w-12 rounded-2xl object-cover border border-white/15 shadow-md shrink-0"
            />
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ns-gold)]">
                <Sparkles size={12} /> 24/7 Villa Concierge
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Ho · Volta Region · Ghana</p>
            </div>
          </div>
        </div>

        <h1 className="mt-4 font-['Outfit'] text-2xl font-black tracking-tight text-white">
          At Your Service
        </h1>
        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
          Order authentic Ghanaian culinary specialties, fresh linens, private Volta airport transfers, or tailor-made villa amenities.
        </p>

        {/* Quick Contact Actions with Real Phone */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <a
            href={`tel:${villaCleanPhone}`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/10 hover:bg-white/20 transition active:scale-95"
          >
            <PhoneCall size={15} className="text-emerald-400" />
            <span>Call Reception</span>
          </a>
          <a
            href={`https://wa.me/${villaCleanPhone.replace('+', '')}?text=Hello%20NS%20Luxury%20Villa%20Concierge`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366]/20 px-3 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-[#25D366]/30 hover:bg-[#25D366]/30 transition active:scale-95"
          >
            <MessageCircle size={15} className="text-[#25D366]" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Active Service Requests (if any) */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
              Your Active Requests ({requests.length})
            </h3>
          </div>
          <div className="space-y-2">
            {requests.slice(0, 3).map((req) => {
              const meta = getStatusBadge(req.status);
              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.bg}`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-[var(--ns-muted)]">
                          Est: {req.estimatedArrival}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--ns-ink)] mt-1 truncate">{req.title}</h4>
                      {req.roomNumber && (
                        <p className="text-[11px] text-[var(--ns-muted)]">For Room {req.roomNumber}</p>
                      )}
                    </div>
                    {req.status === 'PENDING' && (
                      <button
                        onClick={() => conciergeService.cancelRequest(req.id)}
                        className="text-[11px] font-semibold text-rose-500 hover:underline shrink-0"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories Filter */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Services' },
            { id: 'dining', label: 'In-Villa Dining' },
            { id: 'housekeeping', label: 'Housekeeping' },
            { id: 'experiences', label: 'Experiences' },
            { id: 'comfort', label: 'Comfort' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeCategory === cat.id
                  ? 'bg-[var(--ns-gold)] text-white shadow-md'
                  : 'border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const IconComp = iconMap[item.iconName] || Sparkles;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-4 shadow-sm hover:border-[var(--ns-gold)]/50 transition-all active:scale-[0.99]"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--ns-gold)]/10 text-[var(--ns-gold)]">
                  <IconComp size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-['Outfit'] text-sm font-bold text-[var(--ns-ink)] leading-snug">
                      {item.title}
                    </h4>
                    {item.popular && (
                      <span className="shrink-0 rounded-md bg-[var(--ns-gold)]/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--ns-gold)]">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--ns-muted)] line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ns-muted)]">
                      <Clock size={12} /> {item.estTime}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-['Outfit'] text-xs font-extrabold text-[var(--ns-gold)]">
                        {item.price > 0 ? `${item.currency} ${item.price}` : 'Complimentary'}
                      </span>
                      <span className="rounded-xl bg-[var(--ns-gold)] px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                        Request
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Service Request Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-[32px] border-t border-[var(--ns-glass-line)] bg-[var(--ns-bg)] text-[var(--ns-ink)] shadow-2xl p-5">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--ns-glass-line)]" />

            <div className="flex items-center justify-between pb-3 border-b border-[var(--ns-glass-line)]">
              <div>
                <h3 className="font-['Outfit'] text-base font-bold">{selectedItem.title}</h3>
                <span className="text-xs text-[var(--ns-gold)] font-bold">
                  {selectedItem.price > 0 ? `${selectedItem.currency} ${selectedItem.price}` : 'Complimentary Service'}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-full p-2 text-[var(--ns-muted)] hover:bg-[var(--ns-glass-1)]"
              >
                <X size={20} />
              </button>
            </div>

            {successMsg ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={44} className="mx-auto text-emerald-500 animate-bounce" />
                <h4 className="text-base font-bold text-[var(--ns-ink)]">{successMsg}</h4>
                <p className="text-xs text-[var(--ns-muted)]">
                  Our hospitality team is preparing your request.
                </p>
              </div>
            ) : (
              <form onSubmit={handleOrder} className="mt-4 space-y-3.5">
                <p className="text-xs text-[var(--ns-muted)] leading-relaxed">
                  {selectedItem.description}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1">Room / Villa Suite</label>
                    <input
                      type="text"
                      placeholder="e.g. 104"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2 text-sm text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1">Resident Name</label>
                    <input
                      type="text"
                      placeholder="Guest name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2 text-sm text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ns-muted)] mb-1">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Preferred delivery time, dietary allergies, quiet knock..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2 text-sm text-[var(--ns-ink)] outline-none focus:border-[var(--ns-gold)]"
                  />
                </div>

                <div className="rounded-xl bg-[var(--ns-glass-1)] p-3 text-xs text-[var(--ns-muted)] flex items-center justify-between">
                  <span>Estimated Fulfillment:</span>
                  <strong className="text-[var(--ns-ink)]">{selectedItem.estTime}</strong>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-[var(--ns-gold)] py-3 text-sm font-bold text-white shadow-md hover:opacity-95 transition disabled:opacity-50"
                >
                  {submitting ? 'Sending Request...' : 'Confirm Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
