# User Guide — BarberHouse

## Customers

1. Open the site, pick a service and barber (or tap "Book with {name}" on a barber card to preselect them).
2. Choose a date, then a time slot. Unavailable times are labeled — they reflect shop hours, barber time-off, and lead time.
3. Check out as guest (email) or log in. Your slot is held for 10 minutes while you pay.
4. Pay by scanning the PayMongo QR Ph code with any QR Ph-capable wallet/bank app. The page polls booking status and confirms automatically.
5. Download the ICS file or use the confirmation link to add it to your calendar. Manage or cancel from Dashboard (holds require confirm-press).
6. Reminders arrive by email 24h and 1h before. Running late? Reschedule from Dashboard instead of no-showing — repeated no-shows may incur a fee.

## Staff (`/staff`)

- **Schedule:** today's bookings at a glance (auto-refreshes every 15s).
- **Status:** accept / reject / complete / mark no-show per booking.
- **Time off:** request dates under Time Off; admin approval applies shop-wide.
- **Earnings:** payouts view for completed services.

## Admins (`/admin`)

- **Staff:** add barbers, assign services, deactivate leavers.
- **Services:** create/edit pricing (ranges shown per barber where they differ).
- **Bookings:** shop-wide list, intervene on disputes.
- **Analytics:** revenue + utilization.
- **Settings:** hours, lead time, reminder opt-outs.
- **Time off:** approve staff requests, block shop-wide dates (holidays).

## Notifications

Booking confirmations, changes, and 24h/1h reminders arrive by email.
Open Dashboard → Notifications to toggle each channel (booking emails,
reminder emails, push on changes, push reminders) or turn on browser push
to get buzzed even with the tab closed. Staff day-sheets update live —
no refresh needed.

## Payments & refunds policy
Deposits are 20% by default (configurable). Cancellations inside the
allowed window are refunded via PayMongo; outside-window or no-show fees
follow the shop's posted policy. Refunds are issued by admins from the
payment record — allow wallet/bank settlement time after approval.
