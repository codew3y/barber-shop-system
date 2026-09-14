# Phase 1: Research & Discovery — Barber Shop Booking System

## 1. Competitive Analysis

### Market Overview
The barber shop booking software market is mature with several strong players. Key statistics:
- **94% of clients prefer businesses that offer online booking** (Fresha, 2026)
- **40% of all appointments are booked after hours** (Fresha, 2026)
- **7+ million active users** on Booksy's marketplace globally

### Major Players Comparison

| Platform | Best For | Pricing | Key Differentiators | Weaknesses |
|----------|----------|---------|---------------------|------------|
| **Fresha** | Budget-conscious shops wanting marketplace exposure | Free base + $19.95/mo staff plans | Free tier, marketplace, group booking, smart waitlist | Less barber-specific features |
| **Booksy** | Solo barbers and small shops needing marketing | $29.99/mo + $20/staff | Consumer marketplace, 24/7 support, built-in marketing | Competitors shown next to you in marketplace |
| **Squire** | Multi-location barbershops needing operations control | $30-$250/mo tiered | Barber-native design, automated payroll, POS integration | Client booking fees ($1-$3), steeper learning curve |
| **Vagaro** | Feature-rich, affordable for any size | $23.99/mo | All-in-one (booking, POS, payroll), built-in marketing | Less barber-specific than Squire |
| **StyleSeat** | Smart pricing and client discovery | $35/mo | Smart Pricing feature, client discovery | Limited multi-location support |
| **Square** | Solo barbers needing integrated payments | Free solo plan | Top-rated POS hardware, free starting plan | Limited for multi-staff shops |
| **theCut** | Mobile-first, community platform | Free / $25/mo Pro | Free booking/payments, portfolios, community focus | Less enterprise features |

### Table-Stakes Features (Must-Have)
1. **Online booking** — 24/7 self-service with real-time availability
2. **Staff/stylist selection** — Choose specific barber or "any available"
3. **Service menus** — Variable duration, pricing, and descriptions
4. **Calendar management** — Daily/weekly views for staff and admins
5. **Automated reminders** — SMS/email before appointments
6. **Payment processing** — Deposits or full payment upfront
7. **No-show protection** — Deposits, cancellation policies, blocked repeat offenders
8. **Mobile-responsive** — 60%+ bookings happen on mobile devices
9. **Walk-in queue management** — Real-time queue with wait time estimates
10. **Basic analytics** — Revenue, booking volume, no-show rates

### Differentiator Features (Nice-to-Have)
1. **Consumer marketplace** — Discovery platform for new customers (Booksy, Fresha)
2. **AI-powered features** — Smart pricing, automated call answering (Zenoti, Blismo)
3. **Loyalty/rewards program** — Points, punch cards, referral bonuses
4. **Recurring bookings** — Subscription-style appointments
5. **Multi-location management** — Centralized dashboard for multiple shops
6. **Custom branded apps** — Native mobile apps with shop branding (Squire)
7. **Instagram booking** — Book directly from social profiles (Squire)
8. **Integrated payroll** — Automated commission calculations and payouts
9. **Inventory management** — Product sales tracking
10. **Client notes/photos** — Service history, preferences, before/after photos

---

## 2. Core Requirements

### MVP Scope (Phase 1)
**Must-Have for Launch:**
- User registration and authentication (customer, staff, admin roles)
- Shop browsing and service selection
- Real-time availability checking
- Booking creation with slot locking
- Payment processing (deposits or full)
- Automated email/SMS confirmations and reminders
- Staff dashboard with daily schedule
- Admin dashboard for shop management
- Basic analytics (revenue, bookings, no-shows)

**Nice-to-Have (Phase 2+):**
- Consumer marketplace/discovery
- Loyalty program
- Recurring bookings
- Multi-location support
- Custom branded mobile apps
- Advanced analytics and reporting
- AI-powered features

### Business Rules
1. **Booking Window**: Customers can book up to 60 days in advance
2. **Cancellation Policy**: Free cancellation up to 24 hours before; 50% charge within 24 hours
3. **No-Show Policy**: Full charge after 15 minutes late; repeat offenders blocked
4. **Deposit Requirement**: Optional per-shop setting (default: 20% for new customers)
5. **Buffer Time**: 5-15 minutes between appointments (configurable per service)
6. **Minimum Lead Time**: 30 minutes before next available slot

---

## 3. User Flows

### Guest/Customer Flow
```
Browse Shop → Pick Service → Pick Barber ("any" or specific) → 
Pick Time Slot → Enter Details → Pay/Deposit → Confirm → 
Receive Reminder → Check In → Rate/Review
```

**Edge Cases:**
- Double-booking attempt → Show "slot no longer available" with alternatives
- Cancellation → Refund per policy, slot becomes available
- Reschedule → Old slot released, new slot locked
- No-show → Auto-charge, mark as no-show, notify staff

### Returning Customer Flow
```
Login → Rebook Favorite → View History → 
Manage Upcoming Bookings → Cancel/Reschedule → Save Payment Method
```

### Barber/Staff Flow
```
View Daily Schedule → Block Time Off → Accept/Reject Booking → 
Mark No-Show → View Earnings → Manage Own Service List
```

**Edge Cases:**
- Staff changes availability → Update受影响 bookings or block future slots
- Staff calls in sick → Admin reassigns bookings to other staff

### Shop Owner/Admin Flow
```
Manage Staff → Manage Services & Pricing → 
View Analytics/Revenue → Configure Booking Rules → 
Manage Multiple Locations
```

### System Automated Flows
```
Send Reminders (24h, 1h before) → 
Auto-Release Abandoned Holds → 
Handle Payment Webhooks → 
Sync External Calendars → 
Flag Suspicious Bookings → 
Clean Up Expired Holds (cron job)
```

---

## 4. Technical Constraints

### Time Zone Handling
- **Storage**: Always UTC in database
- **Display**: Convert to shop's local timezone at presentation layer
- **Edge Cases**: 
  - DST transitions (slots may be skipped or duplicated)
  - Shops in different timezones (multi-location)
  - Customers booking across timezones

### Concurrency Control (Double-Booking Prevention)
**Recommended Strategy**: Pessimistic locking with `SELECT FOR UPDATE`
- Lock row at read time
- Other transactions block until commit/rollback
- Unique constraint as safety net

**Alternative**: Optimistic locking with version columns
- Read without locking
- Update only if version matches
- Retry on conflict

**Slot Locking Flow**:
1. Customer selects slot → API creates temporary hold (expires in 10 minutes)
2. Payment processed → Hold converted to confirmed booking
3. Payment fails or timeout → Hold released, slot becomes available

### Payment Gateway Constraints
- **PCI Compliance**: Never store raw card data
- **Tokenization**: Use Stripe/Adyen with customer tokens
- **Webhook Verification**: Mandatory signature verification
- **Idempotency**: Required for all payment endpoints
- **Refunds**: Support full and partial refunds per cancellation policy

### SMS/Email Provider Constraints
- **Rate Limits**: 
  - Twilio: 1 message/second per phone number (adjustable)
  - SendGrid: 100 emails/second on paid plans
- **Cost Model**:
  - SMS: $0.0075/message (US), $0.02-0.05 (international)
  - Email: $0.0001/email (SendGrid Essentials)
- **Delivery Tracking**: Webhooks for delivery status
- **Compliance**: CAN-SPAM, GDPR for email; TCPA for SMS

### Offline/Poor Connectivity
- **Staff App**: Queue actions locally, sync when online
- **Walk-in Shop**: Front desk must work with intermittent connectivity
- **Retry Logic**: Exponential backoff for failed API calls
- **Offline Indicators**: Show connectivity status to staff

### Mobile-First Constraints
- **Responsive Design**: Mobile-first, then tablet, then desktop
- **Touch Targets**: Minimum 44x44px for interactive elements
- **Performance**: <3 second load on 3G networks
- **Offline Support**: Core booking flow should work with poor connectivity

---

## 5. Regulatory & Compliance

### Data Privacy
- **GDPR** (EU customers): Right to deletion, data portability, consent management
- **CCPA** (California): Opt-out of data sale, deletion requests
- **Data Minimization**: Only collect necessary information
- **Retention Policy**: Define how long to keep booking/customer data

### Payment Regulations
- **PCI-DSS Level 1**: If processing >6M transactions/year
- **PCI-DSS Level 4**: If processing <20K transactions/year (most barbershops)
- **Stripe/Adyen**: Handle PCI compliance for you via tokenization

### Accessibility
- **WCAG 2.1 AA**: Minimum standard for public-facing booking flow
- **Key Requirements**:
  - Screen reader compatibility
  - Keyboard navigation
  - Color contrast ratios
  - Form labels and error messages

---

## 6. Milestone Plan

| Milestone | Exit Criteria | Target | Owner |
|-----------|---------------|--------|-------|
| **M0 — Discovery Complete** | User flows, requirements doc, competitive analysis signed off | Week 1-2 | Product |
| **M1 — Architecture & Schema Locked** | ERD, API contract (OpenAPI spec), component tree approved | Week 3 | Engineering |
| **M2 — Auth & Core Booking MVP** | User can register, browse services, book a slot, receive confirmation | Week 4-6 | Engineering |
| **M3 — Staff/Admin Dashboard** | Staff can manage schedule; admin can manage services & staff | Week 7-8 | Engineering |
| **M4 — Payments & Notifications** | Deposits, cancellations, SMS/email reminders working end-to-end | Week 9-10 | Engineering |
| **M5 — Security Hardening & QA** | Pen-test/audit pass, load test for concurrent booking, accessibility pass | Week 11 | Security/QA |
| **M6 — Deployment & Monitoring** | CI/CD pipeline live, logging/alerting, rollback plan tested | Week 12 | DevOps |

### Dependencies & Risks
1. **Payment Integration**: Stripe/Adyen approval may take 1-2 weeks
2. **SMS Provider**: Twilio phone number provisioning can be slow
3. **Mobile App**: Consider React Native or Flutter for cross-platform
4. **Load Testing**: Need realistic test data for concurrent booking scenarios

---

## 7. Definition of Done

A production-ready v1 should satisfy all of the following:

- [ ] Customer can browse shops/services/staff and complete a booking end-to-end on mobile and desktop
- [ ] No double-booking possible under concurrent load (verified with load/race-condition tests)
- [ ] Staff can manage their own schedule and see upcoming appointments in real time
- [ ] Admin can manage services, staff, pricing, and view basic revenue/utilization analytics
- [ ] Payments (deposit or full) process through a PCI-compliant provider; refunds/cancellations work per policy
- [ ] SMS/email reminders sent reliably with delivery tracking
- [ ] All endpoints enforce role-based access control server-side; verified via automated authz tests
- [ ] Security review/pen-test completed with critical/high findings resolved
- [ ] Accessibility pass (WCAG 2.1 AA) on customer-facing booking flow
- [ ] CI/CD pipeline with automated tests gating deployment
- [ ] Monitoring, error tracking, and alerting live in production
- [ ] Documented rollback plan and database migration strategy
- [ ] Data privacy policy and retention rules implemented and documented

---

## Next Steps
1. Review and approve this research document
2. Proceed to Phase 2: Architecture & Design
3. Begin implementation with Phase 3: Auth & Core Booking MVP
