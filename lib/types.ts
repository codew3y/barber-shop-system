export interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  timezone: string;
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | string;
  bufferMinutes: number;
  category: string | null;
  priceRange?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface StaffMember {
  id: string;
  bio: string | null;
  title: string | null;
  specialties: string[];
  user: { firstName: string; lastName: string; avatarUrl: string | null };
  services?: { customPrice?: number | string | null; service: { id: string; name: string } }[];
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface Booking {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  startAt: string;
  endAt: string;
  holdExpiresAt: string | null;
  notes: string | null;
  service?: Service;
  shop?: Shop;
  staff?: StaffMember;
  notifications?: Notification[];
}

export interface Notification {
  id: string;
  channel: 'email' | 'sms' | 'push';
  type: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  subject: string | null;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}
