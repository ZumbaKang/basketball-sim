import type { Conference, GmDirection, Position } from "@basketball-sim/shared";

export type SeedTeamDef = {
  name: string;
  abbreviation: string;
  conference: Conference;
  division: string;
  gmDirection: GmDirection;
  strength: number;
};

const EAST_ATLANTIC: [string, string, number, GmDirection][] = [
  ["Harbor Hawks", "HHK", 84, "contend"],
  ["Metro Foxes", "MFX", 80, "window"],
  ["Liberty Lynx", "LLX", 76, "window"],
  ["Capital Colts", "CCT", 72, "rebuild"],
  ["Shoreline Sharks", "SHK", 68, "tank"],
];

const EAST_CENTRAL: [string, string, number, GmDirection][] = [
  ["Ironclad Irons", "IRI", 83, "contend"],
  ["Lakeside Lancers", "LSL", 79, "window"],
  ["River Rats", "RRT", 75, "window"],
  ["Forge Falcons", "FFC", 71, "rebuild"],
  ["Summit Sparks", "SSK", 67, "cheap"],
];

const EAST_SOUTH: [string, string, number, GmDirection][] = [
  ["Bayou Bisons", "BBS", 81, "contend"],
  ["Palmetto Panthers", "PMP", 77, "window"],
  ["Citrus Comets", "CCM", 74, "window"],
  ["Gulf Giants", "GGI", 70, "rebuild"],
  ["Magnolia Monarchs", "MMN", 66, "tank"],
];

const WEST_PACIFIC: [string, string, number, GmDirection][] = [
  ["Canyon Coyotes", "CCY", 85, "contend"],
  ["Pacific Pirates", "PPR", 81, "window"],
  ["Golden Gales", "GGL", 77, "window"],
  ["Redwood Rangers", "RWR", 73, "rebuild"],
  ["Seabreeze Sirens", "SBS", 69, "cheap"],
];

const WEST_MOUNTAIN: [string, string, number, GmDirection][] = [
  ["Peak Pioneers", "PPN", 82, "contend"],
  ["Desert Drifters", "DDR", 78, "window"],
  ["Mesa Mavericks", "MMV", 74, "window"],
  ["Silver Stallions", "SST", 70, "rebuild"],
  ["Highline Hounds", "HLH", 66, "tank"],
];

const WEST_NORTH: [string, string, number, GmDirection][] = [
  ["Timber Titans", "TTN", 80, "contend"],
  ["Prairie Pulsars", "PPL", 76, "window"],
  ["Frontier Foxes", "FFX", 72, "window"],
  ["Northern Nomads", "NNM", 68, "rebuild"],
  ["Aurora Aces", "AAC", 64, "cheap"],
];

function pack(
  rows: [string, string, number, GmDirection][],
  conference: Conference,
  division: string,
): SeedTeamDef[] {
  return rows.map(([name, abbreviation, strength, gmDirection]) => ({
    name,
    abbreviation,
    conference,
    division,
    strength,
    gmDirection,
  }));
}

export const FRANCHISE_TEAMS: SeedTeamDef[] = [
  ...pack(EAST_ATLANTIC, "East", "Atlantic"),
  ...pack(EAST_CENTRAL, "East", "Central"),
  ...pack(EAST_SOUTH, "East", "South"),
  ...pack(WEST_PACIFIC, "West", "Pacific"),
  ...pack(WEST_MOUNTAIN, "West", "Mountain"),
  ...pack(WEST_NORTH, "West", "North"),
];

const FIRST = [
  "Jonah", "Ellis", "Malik", "Omar", "Theo", "Kai", "Devon", "Riley", "Hugo", "Marcus",
  "Rex", "Vince", "Caleb", "Ike", "Dorian", "Quinn", "Brett", "Hector", "Ivan", "Jules",
  "Andre", "Chris", "Nate", "Ben", "Sam", "Finn", "Jasper", "Leo", "Owen", "Paul",
];
const LAST = [
  "Pike", "Shore", "Trent", "Vale", "Crane", "Mercer", "Blake", "Frost", "Lane", "Cole",
  "Dalton", "Ortega", "Moss", "Barlow", "Knox", "Avery", "Colson", "Diaz", "Brooks", "West",
  "Bell", "Holt", "Quill", "Rook", "Drift", "Adler", "York", "Pratt", "Greer", "Hines",
];

const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C", "SG", "SF", "PF", "C", "PG"];

export function ratingsFromOverall(overall: number) {
  return {
    overall,
    offense: overall,
    defense: Math.max(40, overall - 3),
    shooting: Math.max(40, overall - 2),
    rebounding: Math.max(40, overall - 5),
    playmaking: Math.max(40, overall - 4),
    stamina: Math.max(40, overall - 1),
  };
}

export function makeRoster(teamIndex: number, strength: number) {
  return POSITIONS.map((position, i) => {
    const overall = Math.max(55, Math.min(92, strength - i * 2 + ((teamIndex + i) % 3) - 1));
    const age = 20 + ((teamIndex * 3 + i * 2) % 15);
    const potential = Math.min(95, overall + (age < 25 ? 8 : age < 30 ? 3 : 0));
    const name = `${FIRST[(teamIndex * 7 + i) % FIRST.length]} ${LAST[(teamIndex * 11 + i * 3) % LAST.length]}`;
    const r = ratingsFromOverall(overall);
    const rotationOrder = i;
    const targetMinutes = i < 5 ? 32 - i : Math.max(8, 22 - (i - 5) * 2);
    const salary = Math.round((overall * overall * 18000) / 1000) * 1000;
    const yearsRemaining = 1 + ((teamIndex + i) % 4);
    return {
      name,
      position,
      age,
      potential,
      rotationOrder,
      targetMinutes,
      salary,
      yearsRemaining,
      ...r,
    };
  });
}
