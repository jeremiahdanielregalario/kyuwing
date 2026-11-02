import { GameDayType, PlayerCategory, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Production bootstrap: venues and fee rules only.
 *
 * This intentionally does NOT create demo players or a demo game day. Run
 * `pnpm db:seed` for the local demo dataset instead.
 *
 * The fee amounts below are PLACEHOLDERS. Replace them in Venues → Fees before
 * collecting real money.
 */
const VENUES = [
  {
    shortName: "KBC",
    name: "Kalayaan Badminton Center",
    dayOfWeek: 1,
    defaultStart: "10:00",
    defaultEnd: "14:00",
    defaultCourts: 3,
    address: "Kalayaan Ave., Diliman, Quezon City",
  },
  {
    shortName: "DASC",
    name: "Don Antonio Sports Center",
    dayOfWeek: 6,
    defaultStart: "09:00",
    defaultEnd: "13:00",
    defaultCourts: 4,
    address: "Don Antonio Heights, Quezon City",
  },
] as const;

type FeeRow = {
  category: PlayerCategory;
  regular: [number, number];
  tipid: [number, number];
  mega: [number, number];
};

const FEES: Record<string, FeeRow[]> = {
  KBC: [
    { category: PlayerCategory.ACTIVE, regular: [250, 50], tipid: [180, 0], mega: [300, 50] },
    { category: PlayerCategory.ALUMNI, regular: [320, 60], tipid: [230, 0], mega: [370, 60] },
    { category: PlayerCategory.APPLICANT, regular: [350, 60], tipid: [250, 0], mega: [400, 60] },
  ],
  DASC: [
    { category: PlayerCategory.ACTIVE, regular: [300, 60], tipid: [220, 0], mega: [350, 60] },
    { category: PlayerCategory.ALUMNI, regular: [370, 70], tipid: [270, 0], mega: [420, 70] },
    { category: PlayerCategory.APPLICANT, regular: [400, 70], tipid: [300, 0], mega: [450, 70] },
  ],
};

async function main() {
  console.log("Bootstrapping Kyuwing production data (venues + fee rules)…");

  for (const venue of VENUES) {
    const record = await prisma.venue.upsert({
      where: { shortName: venue.shortName },
      update: {
        name: venue.name,
        dayOfWeek: venue.dayOfWeek,
        defaultStart: venue.defaultStart,
        defaultEnd: venue.defaultEnd,
        defaultCourts: venue.defaultCourts,
        address: venue.address,
      },
      create: venue,
    });

    for (const row of FEES[venue.shortName]) {
      const values: Array<[GameDayType, [number, number]]> = [
        [GameDayType.REGULAR, row.regular],
        [GameDayType.TIPID, row.tipid],
        [GameDayType.MEGA, row.mega],
      ];
      for (const [dayType, [flatFee, perGameFee]] of values) {
        await prisma.feeRule.upsert({
          where: { venueId_dayType_category: { venueId: record.id, dayType, category: row.category } },
          update: { flatFee, perGameFee },
          create: { venueId: record.id, dayType, category: row.category, flatFee, perGameFee },
        });
      }
    }

    console.log(`  ✓ ${venue.shortName} — ${venue.name}`);
  }

  console.log("");
  console.log("Done. No players or game days were created.");
  console.log("⚠  Fee amounts are placeholders. Set the approved rates in Venues → Fees.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
