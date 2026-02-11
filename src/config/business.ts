/**
 * SG Gold — Business Configuration
 *
 * All business rules live here as a single typed object.
 * Monetary values are in **paise** (1 INR = 100 paise).
 * Weight values are in **milligrams** (1 gram = 1000 mg).
 *
 * Future: replace this static object with a DB-backed loader
 * (read from a `business_config` Mongo collection) without
 * changing any call-sites — just make `getBusinessConfig()` async.
 */

export const businessConfig = {
  /* ── Regular (Free) Account ─────────────────────────── */
  regular: {
    minBuyMg: 100,                // 100 mg
    maxBuyPerDayMg: 100_000,      // 100 g
    minSellMg: 1_000,             // 1 g
    minWithdrawMg: 1_000,         // 1 g
    gstPercent: 3,
  },

  /* ── Jeweller / Bullion Account ─────────────────────── */
  jeweller: {
    subscriptionSlabsPaise: [
      25_000_00,    // ₹25,000
      50_000_00,    // ₹50,000
      1_00_000_00,  // ₹1,00,000
      2_00_000_00,  // ₹2,00,000
      5_00_000_00,  // ₹5,00,000
    ],
    /** max daily buy (mg) keyed by subscription slab (paise) */
    dailyLimitMg: {
      25_000_00:    100_000,   // 25k  → 100 g
      50_000_00:    250_000,   // 50k  → 250 g
      1_00_000_00:  500_000,   // 1L   → 500 g
      2_00_000_00:  750_000,   // 2L   → 750 g
      5_00_000_00:  1_000_000, // 5L   → 1 kg
    } as Record<number, number>,
    settlementDays: 3,
    taxPercent: 1.5,
  },

  /* ── First-1g Bonus Promotion ───────────────────────── */
  firstGramBonus: {
    bonusPercent: 10,            // 10 % of each buy
    thresholdMg: 1_000,          // active until 1 g total purchased
    maxBonusMg: 100,             // 100 mg cap
  },

  /* ── 11-Month Scheme ────────────────────────────────── */
  scheme: {
    durationMonths: 11,
    cycleDays: 30,
    slabs: [
      { monthlyPaise: 5_000_00,      bonusPaise: 10_000_00 },
      { monthlyPaise: 10_000_00,     bonusPaise: 20_000_00 },
      { monthlyPaise: 20_000_00,     bonusPaise: 40_000_00 },
      { monthlyPaise: 40_000_00,     bonusPaise: 80_000_00 },
      { monthlyPaise: 60_000_00,     bonusPaise: 1_20_000_00 },
      { monthlyPaise: 80_000_00,     bonusPaise: 1_60_000_00 },
      { monthlyPaise: 1_00_000_00,   bonusPaise: 2_40_000_00 },
    ],
    /** consecutive missed months before penalty kicks in */
    missedThreshold: 2,
    /** placeholder — will be refined after research */
    earlyExitPenaltyPercent: 5,
  },

  /* ── Storage Benefit (passive reward) ───────────────── */
  storageBenefit: {
    thresholdMg: 500_000,  // 500 g minimum holding
    rewardMgPerMonth: 100, // 100 mg / month
  },

  /* ── Physical Delivery ──────────────────────────────── */
  delivery: {
    productTypes: ["coin", "bar"] as const,

    coinWeightsMg: [1_000, 2_000, 5_000, 8_000, 10_000, 20_000, 50_000, 100_000],
    barWeightsMg: [10_000, 20_000, 50_000, 100_000, 500_000, 1_000_000],

    /** flat coin-making charge per unit (paise) — placeholder */
    coinChargePaise: 500_00,
    gstPercent: 3,

    stores: [
      { id: "VIS01", name: "Visakhapatnam",  city: "Visakhapatnam",  state: "Andhra Pradesh" },
      { id: "VIJ01", name: "Vijayawada",     city: "Vijayawada",     state: "Andhra Pradesh" },
      { id: "HYD01", name: "Hyderabad",      city: "Hyderabad",      state: "Telangana" },
      { id: "RAJ01", name: "Rajahmundry",    city: "Rajahmundry",    state: "Andhra Pradesh" },
      { id: "BHI01", name: "Bhimavaram",     city: "Bhimavaram",     state: "Andhra Pradesh" },
      { id: "NAR01", name: "Narsapur",       city: "Narsapur",       state: "Andhra Pradesh" },
      { id: "KAK01", name: "Kakinada",       city: "Kakinada",       state: "Andhra Pradesh" },
      { id: "BHM01", name: "Bhimeshwar",     city: "Bhimeshwar",     state: "Andhra Pradesh" },
      { id: "ANA01", name: "Anakapalli",     city: "Anakapalli",     state: "Andhra Pradesh" },
      { id: "TIR01", name: "Tirupati",       city: "Tirupati",       state: "Andhra Pradesh" },
      { id: "BAP01", name: "Bapatla",        city: "Bapatla",        state: "Andhra Pradesh" },
    ],
  },

  /* ── Sagnex Integration (future) ────────────────────── */
  sagnex: {
    specialOfferCoinMg: 250,  // 250 mg gold coin
    minMonthlyPaise: 10_000_00, // ₹10,000 / month to qualify
  },
} as const;

export type BusinessConfig = typeof businessConfig;
