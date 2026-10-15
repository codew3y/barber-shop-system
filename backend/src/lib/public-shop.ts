/**
 * Field allow-list for the unauthenticated shop endpoints.
 *
 * These routes are reachable by anyone, so they select explicitly rather than
 * spreading the whole row. Returning the model wholesale leaked `ownerId` (an
 * internal user UUID with no use to a public consumer) and `settingsJson` —
 * a free-form column the admin settings form writes to, so any operational
 * flag stored there would have become publicly readable with no warning.
 *
 * Internal bookkeeping (`isActive`, `deletedAt`, `createdAt`, `updatedAt`) is
 * omitted too: the queries already filter on it, so it is noise on the wire.
 *
 * Add a field here only if a public consumer genuinely needs it.
 */
export const publicShopSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  phone: true,
  email: true,
  website: true,
  timezone: true,
} as const;
