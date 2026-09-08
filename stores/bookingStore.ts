'use client';

import { create } from 'zustand';
import type { Service, StaffMember, TimeSlot } from '@/lib/types';

// 'service' covers the combined Barber & Service step.
export type BookingStep = 'service' | 'slot' | 'checkout';

interface BookingState {
  shopId: string | null;
  service: Service | null;
  staff: StaffMember | null;
  slot: TimeSlot | null;
  step: BookingStep;
  start: (shopId: string, staff?: StaffMember | null) => void;
  setService: (s: Service) => void;
  setStaff: (s: StaffMember) => void;
  clearStaff: () => void;
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
  setService: (service) => set({ service, slot: null }),
  setStaff: (staff) => set({ staff, slot: null }),
  clearStaff: () => set({ staff: null, slot: null }),
  setSlot: (slot) => set({ slot }),
  setStep: (step) => set({ step }),
  reset: () => set(initial),
}));
