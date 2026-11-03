import {
  GameDayStatus,
  GameDayType,
  PlayerCategory,
  PrismaClient,
  SessionPlayerStatus,
  SkillLevel,
} from "@prisma/client";

const prisma = new PrismaClient();

const LEVELS: SkillLevel[] = [
  SkillLevel.E_MINUS,
  SkillLevel.E,
  SkillLevel.E_PLUS,
  SkillLevel.DE,
  SkillLevel.D_MINUS,
  SkillLevel.D,
  SkillLevel.D_PLUS,
  SkillLevel.CD,
  SkillLevel.C_MINUS,
  SkillLevel.C,
  SkillLevel.C_PLUS,
  SkillLevel.BC,
  SkillLevel.B_MINUS,
  SkillLevel.B,
  SkillLevel.B_PLUS,
  SkillLevel.AB,
  SkillLevel.A_MINUS,
  SkillLevel.A,
  SkillLevel.A_PLUS,
];

const PLAYERS: Array<{
  nickname: string;
  fullName: string;
  level: SkillLevel;
  category: PlayerCategory;
}> = [
  {
    nickname: "Jose",
    fullName: "Jose Maria Santos",
    level: SkillLevel.A_PLUS,
    category: PlayerCategory.ACTIVE,
  },
  { nickname: "Pat", fullName: "Patricia Lim", level: SkillLevel.A, category: PlayerCategory.ACTIVE },
  { nickname: "Miggy", fullName: "Miguel Reyes", level: SkillLevel.A_MINUS, category: PlayerCategory.ACTIVE },
  { nickname: "Bea", fullName: "Beatrice Cruz", level: SkillLevel.AB, category: PlayerCategory.ACTIVE },
  { nickname: "Nico", fullName: "Nicolas Garcia", level: SkillLevel.B_PLUS, category: PlayerCategory.ACTIVE },
  { nickname: "Trish", fullName: "Trisha Mendoza", level: SkillLevel.B, category: PlayerCategory.ACTIVE },
  { nickname: "Rafa", fullName: "Rafael Villanueva", level: SkillLevel.B, category: PlayerCategory.ALUMNI },
  { nickname: "Kai", fullName: "Kai Fernandez", level: SkillLevel.B_MINUS, category: PlayerCategory.ACTIVE },
  { nickname: "Mika", fullName: "Mika Tan", level: SkillLevel.BC, category: PlayerCategory.ACTIVE },
  { nickname: "Luis", fullName: "Luis Aquino", level: SkillLevel.C_PLUS, category: PlayerCategory.ACTIVE },
  {
    nickname: "Andrea",
    fullName: "Andrea Bautista",
    level: SkillLevel.C_PLUS,
    category: PlayerCategory.ACTIVE,
  },
  { nickname: "Dani", fullName: "Daniela Ramos", level: SkillLevel.C, category: PlayerCategory.ACTIVE },
  { nickname: "Paolo", fullName: "Paolo Navarro", level: SkillLevel.C, category: PlayerCategory.ALUMNI },
  { nickname: "Sam", fullName: "Samantha Yu", level: SkillLevel.C_MINUS, category: PlayerCategory.ACTIVE },
  { nickname: "Enzo", fullName: "Enzo Castillo", level: SkillLevel.C_MINUS, category: PlayerCategory.ACTIVE },
  { nickname: "Cla", fullName: "Clarissa Go", level: SkillLevel.CD, category: PlayerCategory.APPLICANT },
  { nickname: "Ben", fullName: "Benjamin Ong", level: SkillLevel.D_PLUS, category: PlayerCategory.ACTIVE },
  { nickname: "Rica", fullName: "Rica Dela Cruz", level: SkillLevel.D_PLUS, category: PlayerCategory.ACTIVE },
  { nickname: "Jolo", fullName: "Jolo Ramirez", level: SkillLevel.D, category: PlayerCategory.ACTIVE },
  { nickname: "Mela", fullName: "Carmela Flores", level: SkillLevel.D, category: PlayerCategory.APPLICANT },
  {
    nickname: "Tonio",
    fullName: "Antonio Mercado",
    level: SkillLevel.D_MINUS,
    category: PlayerCategory.ALUMNI,
  },
  { nickname: "Iya", fullName: "Iya Salazar", level: SkillLevel.D_MINUS, category: PlayerCategory.ACTIVE },
  { nickname: "Gio", fullName: "Giovanni Padilla", level: SkillLevel.DE, category: PlayerCategory.ACTIVE },
  { nickname: "Nina", fullName: "Nina Velasco", level: SkillLevel.DE, category: PlayerCategory.APPLICANT },
  { nickname: "Migs", fullName: "Miguel Sison", level: SkillLevel.E_PLUS, category: PlayerCategory.ACTIVE },
  { nickname: "Lia", fullName: "Lia Robles", level: SkillLevel.E_PLUS, category: PlayerCategory.APPLICANT },
  { nickname: "Carlo", fullName: "Carlo Diaz", level: SkillLevel.E, category: PlayerCategory.ACTIVE },
  { nickname: "Tess", fullName: "Teresa Lim", level: SkillLevel.E_MINUS, category: PlayerCategory.ALUMNI },
];

function dateOnlyInManila(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

async function main() {
  console.log("Seeding Kyuwing…");

  // ---- Venues + fees -------------------------------------------------------
  const kbc = await prisma.venue.upsert({
    where: { shortName: "KBC" },
    update: {},
    create: {
      name: "Kalayaan Badminton Center",
      shortName: "KBC",
      dayOfWeek: 1,
      defaultStart: "10:00",
      defaultEnd: "14:00",
      defaultCourts: 3,
      address: "Kalayaan Ave., Diliman, Quezon City",
    },
  });

  const dasc = await prisma.venue.upsert({
    where: { shortName: "DASC" },
    update: {},
    create: {
      name: "Don Antonio Sports Center",
      shortName: "DASC",
      dayOfWeek: 6,
      defaultStart: "09:00",
      defaultEnd: "13:00",
      defaultCourts: 4,
      address: "Don Antonio Heights, Quezon City",
    },
  });

  const feeDefaults: Record<
    string,
    Array<{
      category: PlayerCategory;
      regular: [number, number];
      tipid: [number, number];
      mega: [number, number];
    }>
  > = {
    KBC: [
      { category: PlayerCategory.ACTIVE, regular: [250, 50], tipid: [180, 0], mega: [300, 50] },
      { category: PlayerCategory.ALUMNI, regular: [320, 60], tipid: [230, 0], mega: [370, 60] },
      { category: PlayerCategory.APPLICANT, regular: [350, 60], tipid: [250, 0], mega: [400, 60] },
      { category: PlayerCategory.INACTIVE, regular: [320, 60], tipid: [230, 0], mega: [370, 60] },
      { category: PlayerCategory.NON_AFFILIATE, regular: [350, 70], tipid: [250, 0], mega: [400, 70] },
    ],
    DASC: [
      { category: PlayerCategory.ACTIVE, regular: [300, 60], tipid: [220, 0], mega: [350, 60] },
      { category: PlayerCategory.ALUMNI, regular: [370, 70], tipid: [270, 0], mega: [420, 70] },
      { category: PlayerCategory.APPLICANT, regular: [400, 70], tipid: [300, 0], mega: [450, 70] },
      { category: PlayerCategory.INACTIVE, regular: [370, 70], tipid: [270, 0], mega: [420, 70] },
      { category: PlayerCategory.NON_AFFILIATE, regular: [400, 80], tipid: [300, 0], mega: [450, 80] },
    ],
  };

  for (const venue of [kbc, dasc]) {
    for (const row of feeDefaults[venue.shortName]) {
      for (const [dayType, values] of Object.entries({
        REGULAR: row.regular,
        TIPID: row.tipid,
        MEGA: row.mega,
      }) as Array<[GameDayType, [number, number]]>) {
        await prisma.feeRule.upsert({
          where: {
            venueId_dayType_category: {
              venueId: venue.id,
              dayType,
              category: row.category,
            },
          },
          update: { flatFee: values[0], perGameFee: values[1] },
          create: {
            venueId: venue.id,
            dayType,
            category: row.category,
            flatFee: values[0],
            perGameFee: values[1],
          },
        });
      }
    }
  }

  // ---- Players ------------------------------------------------------------
  for (const player of PLAYERS) {
    await prisma.player.upsert({
      where: { nickname: player.nickname },
      update: { level: player.level, category: player.category, fullName: player.fullName },
      create: player,
    });
  }

  const allPlayers = await prisma.player.findMany({ orderBy: { nickname: "asc" } });
  const byNickname = new Map(allPlayers.map((p) => [p.nickname, p]));

  // ---- Demo game day -------------------------------------------------------
  const existing = await prisma.gameDay.findFirst({
    where: { name: "Monday Night Lights (demo)" },
  });

  if (!existing) {
    const today = dateOnlyInManila();
    const gameDay = await prisma.gameDay.create({
      data: {
        name: "Monday Night Lights (demo)",
        venueId: kbc.id,
        date: today,
        type: GameDayType.REGULAR,
        status: GameDayStatus.LIVE,
        startedAt: minutesAgo(95),
        courtPlan: [
          { id: "slot-1", label: "First wave", start: "10:00", end: "12:00", courts: 3 },
          { id: "slot-2", label: "Second wave", start: "12:00", end: "14:00", courts: 4 },
        ],
        notes: "Demo session. Reset the database any time with pnpm db:reset.",
        players: {
          create: allPlayers.map((player, index) => {
            const checkedIn = index < 18;
            return {
              playerId: player.id,
              status: checkedIn ? SessionPlayerStatus.WAITING : SessionPlayerStatus.EXPECTED,
              joinedAt: checkedIn ? minutesAgo(100 - index * 3) : null,
              queuedAt: checkedIn ? minutesAgo(78 - index * 3) : null,
              gamesPlayed: index < 8 ? 1 : 0,
              priority: index > 14 && checkedIn,
            };
          }),
        },
      },
    });

    // Two completed matches + two live matches.
    const completedPairs: Array<[string, string, string, string]> = [
      ["Jose", "Nico", "Pat", "Trish"],
      ["Miggy", "Bea", "Kai", "Mika"],
    ];

    let round = 1;
    for (const [a, b, c, d] of completedPairs) {
      const match = await prisma.match.create({
        data: {
          gameDayId: gameDay.id,
          courtNumber: round,
          round,
          status: "COMPLETED",
          startedAt: minutesAgo(70 - round * 10),
          endedAt: minutesAgo(50 - round * 10),
          players: {
            create: [
              { playerId: byNickname.get(a)!.id, team: 1, slot: 1 },
              { playerId: byNickname.get(b)!.id, team: 1, slot: 2 },
              { playerId: byNickname.get(c)!.id, team: 2, slot: 1 },
              { playerId: byNickname.get(d)!.id, team: 2, slot: 2 },
            ],
          },
        },
      });
      void match;
      round += 1;
    }

    const livePairs: Array<[string, string, string, string, number]> = [
      ["Luis", "Sam", "Andrea", "Enzo", 1],
      ["Dani", "Ben", "Paolo", "Rica", 2],
    ];

    for (const [a, b, c, d, court] of livePairs) {
      await prisma.match.create({
        data: {
          gameDayId: gameDay.id,
          courtNumber: court,
          round: round++,
          status: "LIVE",
          startedAt: minutesAgo(12 + court * 3),
          players: {
            create: [
              { playerId: byNickname.get(a)!.id, team: 1, slot: 1 },
              { playerId: byNickname.get(b)!.id, team: 1, slot: 2 },
              { playerId: byNickname.get(c)!.id, team: 2, slot: 1 },
              { playerId: byNickname.get(d)!.id, team: 2, slot: 2 },
            ],
          },
        },
      });
    }

    const playing = ["Luis", "Sam", "Andrea", "Enzo", "Dani", "Ben", "Paolo", "Rica"];
    await prisma.sessionPlayer.updateMany({
      where: {
        gameDayId: gameDay.id,
        playerId: { in: playing.map((n) => byNickname.get(n)!.id) },
      },
      data: { status: SessionPlayerStatus.PLAYING, queuedAt: null },
    });

    // Permanent pair + requests for the demo.
    const jolo = byNickname.get("Jolo")!;
    const mela = byNickname.get("Mela")!;
    await prisma.sessionPlayer.updateMany({
      where: { gameDayId: gameDay.id, playerId: { in: [jolo.id, mela.id] } },
      data: { permanentPartnerId: mela.id },
    });
    await prisma.sessionPlayer.update({
      where: { gameDayId_playerId: { gameDayId: gameDay.id, playerId: jolo.id } },
      data: { permanentPartnerId: mela.id },
    });
    await prisma.sessionPlayer.update({
      where: { gameDayId_playerId: { gameDayId: gameDay.id, playerId: mela.id } },
      data: { permanentPartnerId: jolo.id },
    });

    await prisma.pairingRequest.createMany({
      data: [
        {
          gameDayId: gameDay.id,
          playerId: jolo.id,
          type: "PAIR_WITH",
          targetPlayerId: mela.id,
        },
        {
          gameDayId: gameDay.id,
          playerId: byNickname.get("Iya")!.id,
          type: "PLAY_AGAINST",
          targetPlayerId: byNickname.get("Tonio")!.id,
        },
      ],
    });
  }

  // Ensure the demo partner pointers are symmetric even if seed was partial.
  const demo = await prisma.gameDay.findFirst({ where: { name: "Monday Night Lights (demo)" } });
  if (demo) {
    const jolo = byNickname.get("Jolo");
    const mela = byNickname.get("Mela");
    if (jolo && mela) {
      await prisma.sessionPlayer.updateMany({
        where: { gameDayId: demo.id, playerId: jolo.id },
        data: { permanentPartnerId: mela.id },
      });
      await prisma.sessionPlayer.updateMany({
        where: { gameDayId: demo.id, playerId: mela.id },
        data: { permanentPartnerId: jolo.id },
      });
    }
  }

  console.log(`Seeded ${LEVELS.length} skill levels, ${PLAYERS.length} players, 2 venues.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
