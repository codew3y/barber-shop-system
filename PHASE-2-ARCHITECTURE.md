# Phase 2: Architecture & Design — Barber Shop Booking System

## 1. Database Schema Design

### Entity Relationship Diagram (ERD)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    users    │────<│    staff    │>────│    shops    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  bookings   │────<│  services   │────<│ availability│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  payments   │     │staff_services│
└─────────────┘     └─────────────┘
       │
       │
       ▼
┌─────────────┐     ┌─────────────┐
│notifications│     │    reviews   │
└─────────────┘     └─────────────┘
```

### Core Tables

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'staff', 'admin', 'super_admin')),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
```

#### shops
```sql
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'US',
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    website VARCHAR(255),
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    settings_json JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_shops_owner ON shops(owner_id);
CREATE INDEX idx_shops_slug ON shops(slug);
CREATE INDEX idx_shops_location ON shops(city, state, country);
```

#### staff
```sql
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    bio TEXT,
    specialties TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, shop_id)
);

-- Indexes
CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_shop ON staff(shop_id);
CREATE INDEX idx_staff_active ON staff(shop_id, is_active);
```

#### services
```sql
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    buffer_minutes INTEGER DEFAULT 5 CHECK (buffer_minutes >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_services_shop ON services(shop_id);
CREATE INDEX idx_services_active ON services(shop_id, is_active);
CREATE INDEX idx_services_category ON services(shop_id, category);
```

#### staff_services
```sql
CREATE TABLE staff_services (
    staff_id UUID NOT NULL REFERENCES staff(id),
    service_id UUID NOT NULL REFERENCES services(id),
    custom_price DECIMAL(10,2), -- Override service price if set
    custom_duration_minutes INTEGER, -- Override duration if set
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (staff_id, service_id)
);

-- Indexes
CREATE INDEX idx_staff_services_staff ON staff_services(staff_id);
CREATE INDEX idx_staff_services_service ON staff_services(service_id);
```

#### availability
```sql
CREATE TABLE availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL CHECK (end_time > start_time),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, day_of_week, start_time)
);

-- Indexes
CREATE INDEX idx_availability_staff ON availability(staff_id);
CREATE INDEX idx_availability_day ON availability(staff_id, day_of_week);
```

#### time_off
```sql
CREATE TABLE time_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL CHECK (end_at > start_at),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_off_staff ON time_off(staff_id);
CREATE INDEX idx_time_off_dates ON time_off(start_at, end_at);
```

#### bookings
```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    staff_id UUID NOT NULL REFERENCES staff(id),
    service_id UUID NOT NULL REFERENCES services(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL CHECK (end_at > start_at),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
    hold_expires_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Critical indexes for performance and double-booking prevention
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_staff ON bookings(staff_id);
CREATE INDEX idx_bookings_shop ON bookings(shop_id);
CREATE INDEX idx_bookings_service ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_at ON bookings(start_at);
CREATE INDEX idx_bookings_end_at ON bookings(end_at);

-- Exclusion constraint to prevent double-booking (PostgreSQL)
-- This is the critical constraint that prevents overlapping bookings for the same staff member
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlap_booking 
    EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'));

-- Partial index for active bookings (faster queries)
CREATE INDEX idx_bookings_active ON bookings(staff_id, start_at, end_at) 
    WHERE status IN ('pending', 'confirmed');

-- Index for hold expiration job
CREATE INDEX idx_bookings_holds ON bookings(hold_expires_at) 
    WHERE hold_expires_at IS NOT NULL AND status = 'pending';
```

#### payments
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'full', 'refund', 'no_show_fee')),
    provider VARCHAR(50) NOT NULL, -- 'stripe', 'adyen', etc.
    provider_ref VARCHAR(255), -- Stripe payment_intent ID, etc.
    provider_charge_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_ref ON payments(provider_ref);
```

#### notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    user_id UUID NOT NULL REFERENCES users(id),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
    type VARCHAR(50) NOT NULL, -- 'booking_confirmed', 'reminder_24h', 'reminder_1h', etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    subject VARCHAR(255),
    content TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_booking ON notifications(booking_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
```

#### reviews
```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    staff_id UUID NOT NULL REFERENCES staff(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(booking_id) -- One review per booking
);

-- Indexes
CREATE INDEX idx_reviews_booking ON reviews(booking_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_staff ON reviews(staff_id);
CREATE INDEX idx_reviews_shop ON reviews(shop_id);
CREATE INDEX idx_reviews_rating ON reviews(shop_id, rating);
```

#### audit_log
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes (append-only table, optimized for queries)
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

### Key Integrity Rules

1. **Double-Booking Prevention**: Exclusion constraint on `bookings` table prevents overlapping time ranges for the same staff member
2. **Hold Expiration**: Job runs every minute to release expired holds (`hold_expires_at < NOW()`)
3. **Soft Deletes**: `deleted_at` on `services`, `staff`, `shops` preserves historical booking integrity
4. **Audit Trail**: All booking/payment state changes logged in `audit_log`
5. **Foreign Keys**: Cascading deletes prevented; use soft deletes for business data

---

## 2. API Design

### Authentication & Authorization

#### Auth Middleware
```typescript
// Middleware to verify JWT and attach user to request
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check role-based access
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

### API Endpoints

#### Auth Routes (Public)
```yaml
POST /api/v1/auth/register
  - Body: { email, password, firstName, lastName, phone? }
  - Response: { user, accessToken, refreshToken }
  - Rate Limit: 5 requests/minute

POST /api/v1/auth/login
  - Body: { email, password }
  - Response: { user, accessToken, refreshToken }
  - Rate Limit: 10 requests/minute

POST /api/v1/auth/refresh
  - Body: { refreshToken }
  - Response: { accessToken, refreshToken }

POST /api/v1/auth/logout
  - Headers: Authorization: Bearer <token>
  - Response: { success: true }

POST /api/v1/auth/forgot-password
  - Body: { email }
  - Response: { success: true }
  - Rate Limit: 3 requests/minute

POST /api/v1/auth/reset-password
  - Body: { token, password }
  - Response: { success: true }
```

#### Shop Routes (Public)
```yaml
GET /api/v1/shops
  - Query: { city?, state?, page?, limit? }
  - Response: { shops: [...], pagination }

GET /api/v1/shops/:shopId
  - Response: { shop, services, staff }

GET /api/v1/shops/:shopId/services
  - Response: { services: [...] }

GET /api/v1/shops/:shopId/staff
  - Response: { staff: [...] }

GET /api/v1/shops/:shopId/staff/:staffId/availability
  - Query: { date, serviceId }
  - Response: { slots: [{ time, available }] }
```

#### Booking Routes (Authenticated)
```yaml
POST /api/v1/bookings
  - Headers: Authorization: Bearer <token>
  - Body: { shopId, staffId, serviceId, startTime }
  - Response: { booking, holdExpiresAt }
  - Rate Limit: 10 requests/minute
  - Idempotency: Required (Idempotency-Key header)

GET /api/v1/bookings/mine
  - Headers: Authorization: Bearer <token>
  - Query: { status?, page?, limit? }
  - Response: { bookings: [...], pagination }

GET /api/v1/bookings/:bookingId
  - Headers: Authorization: Bearer <token>
  - Response: { booking }

PUT /api/v1/bookings/:bookingId/cancel
  - Headers: Authorization: Bearer <token>
  - Body: { reason? }
  - Response: { booking, refund? }

PUT /api/v1/bookings/:bookingId/reschedule
  - Headers: Authorization: Bearer <token>
  - Body: { newStartTime }
  - Response: { booking, holdExpiresAt }
```

#### Staff Routes (Staff/Admin)
```yaml
GET /api/v1/staff/schedule
  - Headers: Authorization: Bearer <token>
  - Query: { date?, week? }
  - Response: { schedule: [...] }
  - Roles: staff, admin

PUT /api/v1/staff/schedule/:bookingId/status
  - Headers: Authorization: Bearer <token>
  - Body: { status: 'confirmed' | 'completed' | 'no_show' }
  - Response: { booking }
  - Roles: staff, admin

POST /api/v1/staff/time-off
  - Headers: Authorization: Bearer <token>
  - Body: { startAt, endAt, reason? }
  - Response: { timeOff }
  - Roles: staff, admin

GET /api/v1/staff/time-off
  - Headers: Authorization: Bearer <token>
  - Query: { status? }
  - Response: { timeOff: [...] }
  - Roles: staff, admin

GET /api/v1/staff/earnings
  - Headers: Authorization: Bearer <token>
  - Query: { startDate, endDate }
  - Response: { earnings, bookings }
  - Roles: staff, admin
```

#### Admin Routes (Admin only)
```yaml
POST /api/v1/admin/staff
  - Headers: Authorization: Bearer <token>
  - Body: { userId, bio?, specialties?, commissionRate? }
  - Response: { staff }
  - Roles: admin

PUT /api/v1/admin/staff/:staffId
  - Headers: Authorization: Bearer <token>
  - Body: { bio?, specialties?, commissionRate?, isActive? }
  - Response: { staff }
  - Roles: admin

DELETE /api/v1/admin/staff/:staffId
  - Headers: Authorization: Bearer <token>
  - Response: { success: true }
  - Roles: admin

POST /api/v1/admin/services
  - Headers: Authorization: Bearer <token>
  - Body: { name, description?, durationMinutes, price, bufferMinutes?, category? }
  - Response: { service }
  - Roles: admin

PUT /api/v1/admin/services/:serviceId
  - Headers: Authorization: Bearer <token>
  - Body: { name?, description?, durationMinutes?, price?, bufferMinutes?, category?, isActive? }
  - Response: { service }
  - Roles: admin

GET /api/v1/admin/analytics
  - Headers: Authorization: Bearer <token>
  - Query: { startDate, endDate, metric? }
  - Response: { revenue, bookings, noShows, utilization }
  - Roles: admin

PUT /api/v1/admin/shop/settings
  - Headers: Authorization: Bearer <token>
  - Body: { settings }
  - Response: { shop }
  - Roles: admin
```

#### Payment Routes
```yaml
POST /api/v1/payments/create-intent
  - Headers: Authorization: Bearer <token>
  - Body: { bookingId, amount, currency? }
  - Response: { clientSecret, paymentIntentId }
  - Roles: customer

POST /api/v1/payments/confirm
  - Headers: Authorization: Bearer <token>
  - Body: { paymentIntentId }
  - Response: { payment, booking }
  - Roles: customer

POST /api/v1/payments/webhook
  - Headers: Stripe-Signature
  - Body: Stripe event
  - No auth required (signature verification)
  - Rate Limit: 100 requests/minute
```

#### Notification Routes (Internal)
```yaml
POST /api/v1/notifications/send
  - Headers: X-Internal-Key: <key>
  - Body: { userId, channel, type, bookingId?, content }
  - Response: { notification }
  - Rate Limit: 1000 requests/minute

GET /api/v1/notifications/status/:notificationId
  - Headers: X-Internal-Key: <key>
  - Response: { notification }
```

### Rate Limiting Strategy

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|--------|
| Auth (login/register) | 5-10 requests | 1 minute |
| Public shop listings | 100 requests | 1 minute |
| Booking creation | 10 requests | 1 minute |
| Payment webhooks | 100 requests | 1 minute |
| Admin operations | 50 requests | 1 minute |
| Internal notifications | 1000 requests | 1 minute |

---

## 3. Frontend Component Hierarchy

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand (lightweight) + React Query (server state)
- **Form Handling**: React Hook Form + Zod validation
- **Authentication**: NextAuth.js or custom JWT handling

### Component Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── forgot-password/
│       └── page.tsx
├── (public)/
│   ├── layout.tsx                 # PublicLayout
│   ├── page.tsx                   # Homepage/ShopBrowser
│   ├── shops/
│   │   ├── page.tsx               # Shop listing
│   │   └── [shopId]/
│   │       ├── page.tsx           # Shop detail
│   │       ├── services/
│   │       │   └── page.tsx       # ServiceSelector
│   │       └── staff/
│   │           └── [staffId]/
│   │               └── page.tsx   # Staff profile + availability
│   └── booking/
│       └── [shopId]/
│           └── page.tsx           # CheckoutFlow
├── (customer)/
│   ├── layout.tsx                 # CustomerDashboard layout
│   ├── dashboard/
│   │   └── page.tsx               # UpcomingBookings
│   ├── bookings/
│   │   ├── page.tsx               # BookingHistory
│   │   └── [bookingId]/
│   │       └── page.tsx           # Booking detail
│   └── profile/
│       └── page.tsx               # ProfileSettings
├── (staff)/
│   ├── layout.tsx                 # StaffDashboard layout
│   ├── dashboard/
│   │   └── page.tsx               # DaySchedule
│   ├── schedule/
│   │   └── page.tsx               # Weekly schedule view
│   ├── time-off/
│   │   └── page.tsx               # TimeOffManager
│   └── earnings/
│       └── page.tsx               # EarningsView
├── (admin)/
│   ├── layout.tsx                 # AdminDashboard layout
│   ├── dashboard/
│   │   └── page.tsx               # AnalyticsPanel
│   ├── staff/
│   │   ├── page.tsx               # StaffManager
│   │   └── [staffId]/
│   │       └── page.tsx           # Staff detail/edit
│   ├── services/
│   │   └── page.tsx               # ServiceManager
│   ├── bookings/
│   │   └── page.tsx               # All bookings view
│   └── settings/
│       └── page.tsx               # ShopSettings
└── api/
    └── auth/
        └── [...nextauth]/
            └── route.ts           # NextAuth handler
```

### Core Components

#### Public Components
```typescript
// components/public/ShopBrowser.tsx
interface ShopBrowserProps {
  filters?: ShopFilters;
  onShopSelect: (shopId: string) => void;
}

// components/public/ServiceSelector.tsx
interface ServiceSelectorProps {
  shopId: string;
  selectedService?: Service;
  onSelect: (service: Service) => void;
}

// components/public/StaffPicker.tsx
interface StaffPickerProps {
  shopId: string;
  serviceId: string;
  selectedStaff?: Staff;
  onSelect: (staff: Staff | 'any') => void;
}

// components/public/SlotPicker.tsx
interface SlotPickerProps {
  shopId: string;
  staffId: string;
  serviceId: string;
  date: Date;
  selectedSlot?: TimeSlot;
  onSelect: (slot: TimeSlot) => void;
}

// components/public/CheckoutFlow.tsx
interface CheckoutFlowProps {
  shopId: string;
  service: Service;
  staff: Staff | 'any';
  slot: TimeSlot;
  onComplete: (booking: Booking) => void;
}
```

#### Dashboard Components
```typescript
// components/dashboard/UpcomingBookings.tsx
interface UpcomingBookingsProps {
  bookings: Booking[];
  onCancel: (bookingId: string) => void;
  onReschedule: (bookingId: string) => void;
}

// components/dashboard/DaySchedule.tsx
interface DayScheduleProps {
  staffId: string;
  date: Date;
  bookings: Booking[];
  onStatusChange: (bookingId: string, status: BookingStatus) => void;
}

// components/dashboard/AnalyticsPanel.tsx
interface AnalyticsPanelProps {
  shopId: string;
  dateRange: DateRange;
  metrics: AnalyticsMetrics;
}
```

### State Management

#### Zustand Stores
```typescript
// stores/bookingStore.ts
interface BookingState {
  selectedShop: Shop | null;
  selectedService: Service | null;
  selectedStaff: Staff | 'any' | null;
  selectedSlot: TimeSlot | null;
  step: 'shop' | 'service' | 'staff' | 'slot' | 'checkout';
  setShop: (shop: Shop) => void;
  setService: (service: Service) => void;
  setStaff: (staff: Staff | 'any') => void;
  setSlot: (slot: TimeSlot) => void;
  reset: () => void;
}

// stores/authStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}
```

### Data Fetching (React Query)
```typescript
// hooks/useBookings.ts
export function useBookings(filters?: BookingFilters) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => fetchBookings(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// hooks/useAvailability.ts
export function useAvailability(shopId: string, staffId: string, date: Date) {
  return useQuery({
    queryKey: ['availability', shopId, staffId, date],
    queryFn: () => fetchAvailability(shopId, staffId, date),
    staleTime: 10 * 1000, // 10 seconds (real-time)
  });
}

// hooks/useCreateBooking.ts
export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}
```

---

## 4. Data Validation Strategy

### Defense in Depth Approach

| Layer | Responsibility | Implementation |
|-------|----------------|----------------|
| **Client (Form)** | Immediate UX feedback | React Hook Form + Zod schemas |
| **API Gateway/Middleware** | Schema validation, auth, rate limiting | Express middleware + Zod |
| **Service/Business Logic** | Domain rules, slot availability | Service layer with validation |
| **Database** | Foreign keys, constraints, exclusion | PostgreSQL constraints |

### Validation Schemas (Zod)

#### Booking Validation
```typescript
// schemas/booking.ts
import { z } from 'zod';

export const createBookingSchema = z.object({
  shopId: z.string().uuid(),
  staffId: z.string().uuid().or(z.literal('any')),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  newStartTime: z.string().datetime(),
});
```

#### Payment Validation
```typescript
// schemas/payment.ts
export const createPaymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
});
```

### Business Rule Validation

#### Slot Availability Check
```typescript
// services/bookingService.ts
async function validateSlotAvailability(
  staffId: string,
  serviceId: string,
  startTime: Date
): Promise<{ valid: boolean; error?: string }> {
  // 1. Check staff exists and is active
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.isActive) {
    return { valid: false, error: 'Staff not found or inactive' };
  }

  // 2. Check service exists and is active
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isActive) {
    return { valid: false, error: 'Service not found or inactive' };
  }

  // 3. Check staff offers this service
  const staffService = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
  });
  if (!staffService) {
    return { valid: false, error: 'Staff does not offer this service' };
  }

  // 4. Calculate end time (service duration + buffer)
  const duration = staffService.customDurationMinutes || service.durationMinutes;
  const buffer = service.bufferMinutes;
  const endTime = new Date(startTime.getTime() + (duration + buffer) * 60 * 1000);

  // 5. Check for overlapping bookings (exclusion constraint will also catch this)
  const overlapping = await prisma.$queryRaw`
    SELECT id FROM bookings
    WHERE staff_id = ${staffId}
      AND status NOT IN ('cancelled', 'no_show')
      AND tstzrange(start_at, end_at) && tstzrange(${startTime}::timestamptz, ${endTime}::timestamptz)
    LIMIT 1
  `;
  if (overlapping.length > 0) {
    return { valid: false, error: 'Time slot is no longer available' };
  }

  // 6. Check staff availability (working hours)
  const dayOfWeek = startTime.getDay();
  const availability = await prisma.availability.findFirst({
    where: {
      staffId,
      dayOfWeek,
      isActive: true,
      startTime: { lte: startTime },
      endTime: { gte: endTime },
    },
  });
  if (!availability) {
    return { valid: false, error: 'Staff not available at this time' };
  }

  // 7. Check time off
  const timeOff = await prisma.timeOff.findFirst({
    where: {
      staffId,
      status: 'approved',
      startAt: { lte: endTime },
      endAt: { gte: startTime },
    },
  });
  if (timeOff) {
    return { valid: false, error: 'Staff has time off during this period' };
  }

  // 8. Check minimum lead time (30 minutes)
  const now = new Date();
  const minLeadTime = new Date(now.getTime() + 30 * 60 * 1000);
  if (startTime < minLeadTime) {
    return { valid: false, error: 'Booking must be at least 30 minutes in advance' };
  }

  return { valid: true };
}
```

---

## 5. Security Architecture

### Authentication System

#### JWT Implementation
```typescript
// lib/auth.ts
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
```

#### Refresh Token Rotation
```typescript
// lib/auth.ts
async function rotateRefreshToken(oldRefreshToken: string) {
  const decoded = verifyRefreshToken(oldRefreshToken);
  
  // Check if token is blacklisted (already used)
  const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
  if (isBlacklisted) {
    throw new Error('Refresh token reuse detected');
  }

  // Blacklist old token
  await redis.setex(`blacklist:${decoded.jti}`, 7 * 24 * 60 * 60, '1');

  // Generate new tokens
  return generateTokens(decoded.userId);
}
```

### Role-Based Access Control (RBAC)

```typescript
// lib/rbac.ts
type Role = 'customer' | 'staff' | 'admin' | 'super_admin';

const permissions = {
  customer: [
    'bookings:create',
    'bookings:read:own',
    'bookings:cancel:own',
    'payments:create',
    'profile:read:own',
    'profile:update:own',
  ],
  staff: [
    'bookings:read:assigned',
    'bookings:update:assigned',
    'schedule:read:own',
    'time-off:create:own',
    'time-off:read:own',
    'earnings:read:own',
  ],
  admin: [
    'staff:create',
    'staff:read:shop',
    'staff:update:shop',
    'staff:delete:shop',
    'services:create:shop',
    'services:read:shop',
    'services:update:shop',
    'services:delete:shop',
    'bookings:read:shop',
    'analytics:read:shop',
    'settings:update:shop',
  ],
  super_admin: ['*'], // All permissions
};

export function hasPermission(role: Role, permission: string): boolean {
  return permissions[role]?.includes(permission) || false;
}
```

### Payment Security

#### Stripe Integration
```typescript
// lib/stripe.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>
) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

export async function handleWebhook(
  payload: Buffer,
  signature: string
) {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
  }
}
```

### Rate Limiting

```typescript
// middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis';

export const createRateLimiter = (windowMs: number, max: number) =>
  rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    }),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

// Specific limiters
export const authLimiter = createRateLimiter(60 * 1000, 10); // 10/minute
export const bookingLimiter = createRateLimiter(60 * 1000, 10); // 10/minute
export const webhookLimiter = createRateLimiter(60 * 1000, 100); // 100/minute
```

### OWASP Top 10 Mitigations

| Threat | Mitigation |
|--------|------------|
| **A01: Broken Access Control** | RBAC enforced server-side on every endpoint; ownership checks for bookings |
| **A02: Cryptographic Failures** | bcrypt for passwords; JWT with strong secrets; TLS everywhere |
| **A03: Injection** | Prisma ORM (parameterized queries); Zod validation at API boundary |
| **A04: Insecure Design** | Threat modeling during design; security review of all endpoints |
| **A05: Security Misconfiguration** | Environment-based secrets; security headers via helmet.js |
| **A06: Vulnerable Components** | Regular dependency updates; npm audit in CI/CD |
| **A07: Auth Failures** | Rate limiting on auth endpoints; account lockout after failures |
| **A08: Data Integrity Failures** | Webhook signature verification; idempotency keys for payments |
| **A09: Logging Failures** | Structured logging; audit trail for all mutations |
| **A10: SSRF** | Input validation; allowlist for external URLs if needed |

### Audit Logging

```typescript
// lib/audit.ts
interface AuditLogEntry {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditLogEntry) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

// Usage in booking service
async function cancelBooking(bookingId: string, userId: string, reason?: string) {
  const oldBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
  
  const newBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledBy: userId,
      cancelledAt: new Date(),
    },
  });

  await logAudit({
    actorId: userId,
    action: 'booking.cancelled',
    entity: 'booking',
    entityId: bookingId,
    oldValue: { status: oldBooking.status },
    newValue: { status: 'cancelled', reason },
  });

  return newBooking;
}
```

---

## 6. Deployment Architecture

### Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                        CDN (Cloudflare)                      │
│                    Static assets, caching                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (AWS ALB)                  │
│                  Health checks, SSL termination             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ECS Fargate / Vercel                      │
│                  Next.js app (frontend + API)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Amazon RDS (PostgreSQL)                   │
│                  Multi-AZ, automated backups                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ElastiCache (Redis)                       │
│                  Sessions, rate limiting, caching           │
└─────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          # Deploy to Vercel/Railway/AWS
          npm run deploy
```

### Monitoring & Alerting

```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';
import { datadog } from '@datadog/browser-rum';

// Error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// Performance monitoring
export function trackBookingCreation(duration: number, success: boolean) {
  // Send to Datadog/New Relic
  datadog.trackEvent('booking.created', {
    duration,
    success,
    timestamp: Date.now(),
  });
}

// Alert thresholds
const ALERT_THRESHOLDS = {
  bookingFailureRate: 0.05, // 5%
  apiResponseTime: 1000, // 1 second
  doubleBookingAttempts: 10, // per minute
};
```

---

## Next Steps

1. Review and approve this architecture document
2. Set up project repository with initial structure
3. Begin Phase 3: Implementation
4. Start with database migrations and authentication
5. Build core booking flow
