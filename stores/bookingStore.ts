'use client';

import { create } from 'zustand';
import type { Service, StaffMember, TimeSlot } from '@/lib/types';

export type BookingStep = 'service' | 'staff' | 'slot' | 'checkout';

interface BookingState {
  shopId: string | null;
  service: Service | null;
  staff: StaffMember | null;
  slot: TimeSlot | null;
  step: BookingStep;
  start: (shopId: string, staff?: StaffMember | null) => void;
  setService: (s: Service) => void;
  setStaff: (s: StaffMember) => void;
  setSlot: (s: TimeSlot) => void;
  setStep: (step: BookingStep) => void;
  reset: () => void;
}

const initial = {
  shopId: null as string | null,
  service: null as Service | null,
  staff: null as StaffMember | null,
  slot: null as TimeSlot | null,
  step: 'service' as BookingStep,
};

export const useBookingStore = create<BookingState>()((set) => ({
  ...initial,
  start: (shopId, staff) => set({ ...initial, shopId, staff: staff ?? null }),
  setService: (service) => set({ service, slot: null, step: 'staff' }),
  setStaff: (staff) => set({ staff, slot: null, step: 'slot' }),
  setSlot: (slot) => set({ slot, step: 'checkout' }),
  setStep: (step) => set({ step }),
  reset: () => set(initial),
}));
