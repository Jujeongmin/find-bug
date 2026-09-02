import { devParam, devFlag } from "../dev";
import { recordBug, codexRows, codexTally } from "./codex";
import { syncBook, queueSync, reportRun } from "../net/save";
import { useGameServer } from "@agent8/gameserver";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import type { SceneSpec } from "../engine/types";
import { officeScene, MACHINES, type MachineId } from "./scene";
import { homeScene } from "../home/scene";
import { streetScene } from "../street/scene";
import { ENGINE_SCENES } from "../stages/registry";
import { Stage04 } from "../stages/stage04/Stage04";
import { sfx } from "../audio/sfx";
import { shipRating, totalStake, type Severity } from "./rating";
import { HAS_KEYBOARD } from "../components/useSpaceCloses";
import { Settings } from "../components/Settings";
import { EyeIcon } from "../components/icons";
import { available as adsAvailable, showRewarded } from "../net/ads";

/**
 * Days to ship. Five left no room to earn: the three things on sale come to
 * 380 and a perfect day pays 140, so equipment arrived just as the run ended.
 */
/**
 * Twelve days to ship, Monday to Friday and round again. Ten of them are
 * working days and two are not: one weekend, in the middle, with the deadline
 * carrying on across it — which is the whole point of having one. The last day
 * is a Friday, so the sprint ends on a working day rather than trailing off.
 */
const DAYS = 12;
const WEEK = 7;
/** Saturday and Sunday: the office is shut unless you decide otherwise */
const isWeekend = (day: number) => (day - 1) % WEEK >= 5;
/** the days that carry a queue, which is what the rating is out of */
const WORK_DAYS = Array.from({ length: DAYS }, (_, i) => i + 1).filter(
  (d) => !isWeekend(d)
);
/** what a Saturday at the desk costs, and what a weekend off the desk gives */
/**
 * Overtime and a weekend shift do not take a point on the spot — they take it
 * out of the night that follows, which is where borrowing actually lands. On
 * the spot would be worse than useless: at six o'clock with nothing left, the
 * half hour buys time to look at a build the player no longer has the
 * condition to open.
 *
 * Two, not one, because the sofa settles a night for free: at one the evening
 * cancelled the whole price and the half hour was a gift rather than a loan.
 * At two, a borrowed night costs a build tomorrow — the sofa takes back half
 * of it and the morning's coffee the rest, and paying both is what the half
 * hour actually costs.
 */
const BORROW_COST = 2;
const HOBBY_PAY = 30;

/** the working day, 09:00 to 18:00 */
const DAY_START = 9 * 60;
const DAY_END = 18 * 60;

/**
 * Game minutes per real second. The clock runs while the world does, so
 * nothing has to be charged for explicitly: crossing the room costs what
 * crossing the room takes, and a build costs what it takes to inspect.
 */
/**
 * How fast the office clock runs, in game minutes per real second.
 *
 * It was 1.5, which made a nine-to-six day six real minutes long — and a
 * playthrough finished three builds by one in the afternoon and the fourth by
 * twenty past two. Three and a half hours of the working day left over, every
 * day, which means the clock never bound on anything: the six o'clock offer
 * could not come up, so nothing ever borrowed against a night, so the chair
 * and the sofa and the half hour were all furniture.
 *
 * At 2.0 that same pace has the fourth build done around ten past four, which
 * leaves the afternoon with something in it without making the day a race. A
 * player slower than that still meets six o'clock with work left, which is the
 * decision the evening economy is made of. The day is four and a half real
 * minutes.
 */
const MINUTES_PER_SECOND = 2.0;

/**
 * How long the screen stays dark between one day and the next.
 *
 * Long enough to read as a night rather than a flicker, short enough that
 * twelve of them are not a tax on the run. The fade in and out are shorter
 * still, so most of it is black rather than grey.
 */
const NIGHT_MS = 900;

/**
 * How the twelve days treated you, which the star rating does not say.
 *
 * A run can ship clean and leave the person who shipped it wrecked, and the
 * game only reported the half the company cares about.
 *
 * Deliberately not a second resource: nothing in the day is spent from it or
 * gated on it. A number with a cost attached becomes a number to optimise,
 * and then a stall on the way home is a chore. It is the second thing the run
 * produces, read at the end beside the first.
 */
const MAX_SPIRIT = 5;
const SPIRIT_START = 3;
/** what the stall costs, and what it is worth */
const POCHA_PAY = 25;

/** things the developer says when there is nothing more pressing */
const IDLE_LINES = 5;
/** tired things the people on the commute say, in rotation */
const PASSER_LINES = 6;

/**
 * ?place=office (or home, street) opens the day in that room.
 *
 * Dev only, and it exists because looking at the office meant walking there
 * from bed every time — three minutes of held arrow keys to check whether a
 * chair had moved four pixels.
 */
/**
 * ?playtest=1 reveals the planted defect inside a build.
 *
 * This one was never gated at all, which meant the answers were a query
 * parameter away in the shipped game while the tools for finding a build to
 * try them on were the ones locked to the dev server — backwards on both
 * counts. It goes behind the same flag as the rest.
 */
const PLAYTEST = devFlag("playtest");

/**
 * ?day=6 opens on that day of the fortnight.
 *
 * Dev only, and it exists for the same reason ?place does: the weekend is on
 * day six, and reaching it by playing five days through is not a way to check
 * whether the weekend works.
 */
/**
 * Every one of these reads a query string, and every one of them is a way to
 * skip work the player is meant to do — start on the day you want to look at,
 * in the room you want to look at, at the hour you want to look at. On a
 * built game that is not a shortcut, it is the answers in the address bar, so
 * they exist on the dev server and nowhere else.
 */
const START_DAY = (() => {
  const asked = Number(devParam("day"));
  return Number.isInteger(asked) && asked >= 1 && asked <= DAYS ? asked : 1;
})();

const START_PLACE = (() => {
  const asked = devParam("place");
  return asked === "office" || asked === "street" ? asked : "home";
})();

/** the clock to open on, as HHMM — the only way to reach six without waiting */
const START_AT = (() => {
  const asked = devParam("at");
  const hhmm = Number(asked);
  if (!asked || !Number.isInteger(hhmm) || hhmm < 0) return null;
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  if (h > 23 || m > 59) return null;
  return Math.min(DAY_END, Math.max(DAY_START, h * 60 + m));
})();

/**
 * Sky through the window, from morning to the end of the day. The header
 * clock is a number; this is the same fact you can feel without reading.
 */
const SKY: { at: number; top: string; bottom: string }[] = [
  { at: 9 * 60, top: "#8fc6ef", bottom: "#d9ecfa" },
  { at: 12 * 60, top: "#63aee8", bottom: "#bfe0f6" },
  { at: 15 * 60, top: "#7bb6e0", bottom: "#e6dcc2" },
  { at: 17 * 60, top: "#d98f52", bottom: "#f2c98a" },
  { at: 18 * 60, top: "#5b4a72", bottom: "#c07a5c" },
];

const mix = (a: string, b: string, t: number) => {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
};

function skyAt(minutes: number) {
  let i = 0;
  while (i < SKY.length - 2 && minutes > SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = Math.max(0, Math.min(1, (minutes - a.at) / (b.at - a.at)));
  return { top: mix(a.top, b.top, t), bottom: mix(a.bottom, b.bottom, t) };
}

/**
 * How lit the street lamps are: nothing in daylight, full once the light has
 * gone. They used to burn at nine in the morning.
 */
const lampAt = (m: number) => Math.max(0, Math.min(1, (m - 16 * 60) / 120));

/** the same scene with the player put somewhere else to start */
function withPlayerAt(scene: SceneSpec, x: number, y: number): SceneSpec {
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === "player" ? { ...o, x, y } : o)),
  };
}

/**
 * The same scene, walked faster.
 *
 * Walking is the tax on every one of these rooms — four machines, a
 * developer, a shop and a door, and a clock running through all of it. Shoes
 * are the one thing on sale that shortens the errand rather than paying for
 * it, so they touch the three rooms the commute is made of and leave the
 * builds alone: how fast the player crosses a build's floor is that build's
 * own business.
 */
function withSpeed(scene: SceneSpec, mult: number): SceneSpec {
  if (mult === 1) return scene;
  return {
    ...scene,
    objects: scene.objects.map((o) =>
      o.id === "player"
        ? {
            ...o,
            behaviors: o.behaviors.map((b) =>
              b.t === "playerTopDown" ? { ...b, speed: b.speed * mult } : b
            ),
          }
        : o
    ),
  };
}

/** 월 화 수 목 금 토 일 — the calendar the ship date does not care about */
const dayName = (day: number) => `week.d${(day - 1) % WEEK}`;

const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;


/**
 * Condition, 0 to 3, and higher is better.
 *
 * It was tiredness, where lower was better — so buying a coffee read as
 * "fatigue -1", which looks like a penalty on the thing you just paid for. A
 * stat you want to raise is one the player can act on without translating.
 *
 * It is the day's capacity, not a tax on the next morning. A point used to
 * mean twenty minutes off tomorrow's start, which meant the player felt it
 * once, the following day, as a clock that had already moved before they
 * could do anything about it. Now it is what a build costs to look at, so it
 * is spent in front of them, on the thing they chose to spend it on.
 */
/*
 * Four, and a night only ever fills three of them.
 *
 * There are four machines and the fourth point is the one you buy: a night
 * gets you to three, and the morning's coffee is the only thing that reaches
 * the top. So the empty pip on the way in is not damage, it is the day
 * saying there is one more build in you if you pay a quarter of an hour for
 * it — which is the whole of the choice the fourth machine exists to pose.
 */
const MAX_CONDITION = 4;

/** what one build takes out of you to look at properly */
const INSPECT_COST = 1;

/**
 * What a night gives back: three, one short of the top.
 *
 * It used to be all of it, back when all of it was also a full day's work.
 * A night still costs nothing and still owes nothing — what it cannot do is
 * reach the fourth point, and what the sofa is for is the nights that were
 * borrowed against.
 */
const SLEEP_RECOVERY = 3;
/**
 * Nine to six is the job. Leaving at any point up to six costs nothing —
 * there used to be a threshold at half four, which read as the game telling
 * the player to knock off an hour and a half early every day.
 *
 * What tires you out is staying past six, which is the only thing overtime
 * is for. The good chair is what makes that hour bearable.
 */

/** what a coffee on the way in costs, and what it is worth */
const COFFEE_MINUTES = 15;

/** how much of the evening a rewarded ad buys back, once a day */
const OVERTIME_MINUTES = 30;

/*
 * How well the developer knows you, counted in defects actually handed over.
 *
 * They were a wall with a rotating line: the walk to their desk paid a bounty
 * and nothing about the walk changed across twelve days. Talking is not the
 * measure — anyone can talk. What they notice is how much of their own work
 * you have caught before it got out.
 *
 * Each step gives back something the day is actually short of, so the office
 * floor is somewhere to build a relationship rather than somewhere to walk.
 */
const DEV_STEPS = [8, 18, 30] as const;
const devLevelFor = (handed: number) =>
  DEV_STEPS.filter((n) => handed >= n).length;

/** the mate's coffee, which costs the fifteen minutes the machine charges */
const DEV_COFFEE_LEVEL = 1;
/**
 * At this point they get up and come to you, once a day.
 *
 * This step used to pay a bigger bounty, which rewards the player with the
 * one thing they already have too much of: the shop holds three hundred and
 * eighty won of goods and a run earns something like eighteen hundred. What
 * a day is short of is minutes, so what a colleague who knows you saves you
 * is the walk.
 */
const DEV_COMES_LEVEL = 2;
/** at this point they come and collect one themselves at the end of the day */
const DEV_COLLECT_LEVEL = 3;

/** what a confirmed defect is worth once the developer has it */
/*
 * A confirmed defect, once the developer has it.
 *
 * These were 20/40/80, which paid something like two thousand won across a
 * run against a shop holding three hundred and eighty. Everything was bought
 * by the third day and the rest of the money was a number that went up. What
 * a wage is for is not being able to afford all of it.
 */
const BOUNTY: Record<Severity, number> = { low: 8, normal: 16, critical: 32 };

/**
 * What a freeze-day fix pays, against an ordinary one.
 *
 * Every build is critical in the freeze, so those two days were the richest
 * in the run — and they are the two days there is nothing left to spend it
 * on. Money arriving after the last thing worth buying is a number going up.
 *
 * Nobody signs off on equipment the week of a release either. Halving it puts
 * every purchase back in the first ten days, which is where a thing that
 * saves you minutes wants to be bought anyway.
 */
const FREEZE_PAY = 0.5;

/** how many pips a severity draws on its machine chip */
const SEVERITY_PIPS: Record<Severity, number> = { low: 1, normal: 2, critical: 3 };

/**
 * Things you can buy, and where. Each one changes a number the player has
 * already felt go against them: the magnifier makes small faults visible, the
 * chair keeps overtime from borrowing against the night, and the alarm hands
 * back half an hour of every morning.
 */
type ItemId =
  | "magnifier"
  | "chair"
  | "alarm"
  | "shoes"
  | "thermos"
  | "retest";

const CATALOGUE: {
  id: ItemId;
  cost: number;
  where: "office" | "home";
}[] = [
  { id: "magnifier", cost: 120, where: "office" },
  { id: "chair", cost: 160, where: "office" },
  { id: "retest", cost: 260, where: "office" },
  { id: "alarm", cost: 100, where: "home" },
  { id: "shoes", cost: 140, where: "home" },
  { id: "thermos", cost: 90, where: "home" },
];

/** how much faster a decent pair of shoes crosses a room */
const SHOES_SPEED = 1.4;
/** what a coffee costs once you are not queueing at the machine for it */
const THERMOS_MINUTES = 5;

/** the alarm clock starts the day this much earlier */
const ALARM_MINUTES = 30;

interface Assignment {
  machine: MachineId;
  sceneId: string;
  severity: Severity;
  /** null until the player has verified it */
  result: null | "caught" | "missed";
  /**
   * A weekend build. Catching one takes back the worst thing that already
   * shipped — but only once the developer has it, because a fix nobody was
   * told about is not a fix. Half a star for twenty minutes of lie-in was
   * the wrong price.
   */
  hotfix?: boolean;
  /**
   * Which defect is in this build. Decided the first time the machine is
   * opened and kept from then on, so stepping away and coming back finds the
   * same build rather than a freshly rolled one.
   */
  bugId: string | null;
}

/**
 * Three builds a day, one per machine. Each day holds exactly one of each
 * severity, and which machine carries the critical one rotates — so there is
 * always a build worth reaching first, and it is never the same walk twice.
 */
/*
 * One per machine, rotated by the day so no machine is always the bad one.
 *
 * Four entries because there are four machines: with three the fourth build
 * doubled a severity that moved from day to day, and the total riding on a
 * day changed with it — which is not something a rating can be a share of.
 */
const SEVERITIES: Severity[] = ["normal", "low", "critical", "normal"];

/**
 * Code freeze: the last two working days, when everything on the machines is
 * critical.
 *
 * Eleven of the twelve days were the same day. The ship date was a number in
 * the corner that counted down past a calendar nothing happened on, and the
 * last morning of the run played exactly like the first.
 *
 * Nothing new is written this close to a release, so what is left on the
 * machines is the work nobody dared touch until now. A day of it weighs
 * sixteen against an ordinary nine, dropping a build costs four times what
 * it costs in week one, and the coffee stops being optional.
 */
const FREEZE_FROM = 11;
const isFreeze = (day: number) => day >= FREEZE_FROM;

/**
 * Every build the game can queue. The card game is not a scene the engine
 * drives — it is its own component — but it is a build like any other from
 * the floor, so it belongs in the rotation rather than behind a URL flag.
 */
const BUILD_IDS = [...ENGINE_SCENES.map((s) => s.id), "stage04"];

function assignDay(day: number, machines: readonly MachineId[] = MACHINES): Assignment[] {
  return machines.map((machine, i) => ({
    machine,
    // a stride that is coprime with the list, so the day's four slide along
    // it instead of alternating between the same two sets
    sceneId: BUILD_IDS[(day * 5 + i) % BUILD_IDS.length],
    severity: isFreeze(day) ? "critical" : SEVERITIES[(i + day) % SEVERITIES.length],
    result: null,
    bugId: null,
  }));
}

/**
 * The QA floor, replacing the stage-select grid.
 *
 * The verification itself is unchanged — the same scene, the same planted
 * defect, the same report. What changes is the frame around it: builds are
 * queued on machines you walk to, a day holds only so many, and the ship date
 * arrives whether or not the queue is clear.
 */
export function Office({ onExit }: { onExit: () => void }) {
  const { t, tp } = useI18n();
  const [day, setDay] = useState(START_DAY);
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    isWeekend(START_DAY) ? [] : assignDay(START_DAY)
  );
  const [running, setRunning] = useState<Assignment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** whether the developer has already made you one today */
  const [devCoffee, setDevCoffee] = useState(false);
  /** whether they have already walked over to collect today */
  const [devCame, setDevCame] = useState(false);
  /** the one re-test the form buys, spent once in a run */
  const [retestUsed, setRetestUsed] = useState(false);
  /** the book of every fault, open on the desk at home */
  const [codex, setCodex] = useState(false);
  /*
   * The night, drawn.
   *
   * Going to bed swapped one lit room for another between two frames: the
   * flat at night and the flat in the morning are the same picture with the
   * player stood somewhere else, so twelve days went by without the game ever
   * showing one of them ending. A second of black is the only thing that says
   * time passed.
   */
  const [night, setNight] = useState(false);
  const [spirit, setSpirit] = useState(SPIRIT_START);
  /** the stall serves once a night */
  const [ateOut, setAteOut] = useState(false);
  /*
   * How much of the book was already filled when this run started, so the
   * ship screen can say what the twelve days added to it. The rating is a
   * report on one run and says nothing about the next; this is the line that
   * does, so it belongs on the screen the player reads last.
   */
  /*
   * The account copy of the book.
   *
   * Local storage draws the game; this is the copy that survives a change of
   * device, which is the only thing a book filling up across runs is for. It
   * folds both ways on arrival and is allowed to fail silently — a book that
   * did not sync is a book that syncs next time.
   */
  const { server, connected } = useGameServer();
  useEffect(() => {
    if (connected) void syncBook(server);
  }, [connected, server]);

  /** so a re-render of the terminal screen does not count the run twice */
  const runReported = useRef(false);
  const [codexAtStart] = useState(() => codexTally(codexRows()).caught);
  const [shipped, setShipped] = useState(false);
  const [caught, setCaught] = useState(0);
  const [missed, setMissed] = useState(0);
  const [minutes, setMinutes] = useState(START_AT ?? DAY_START);
  /** how many times the developer has been spoken to, so idle lines rotate */
  const [talks, setTalks] = useState(0);
  /** the last build signed off, so the developer can react to it once */
  const [lastResult, setLastResult] = useState<null | "caught" | "missed">(null);
  /** caught today but not yet handed to the developer */
  const [pending, setPending] = useState<Assignment[]>([]);
  const [delivered, setDelivered] = useState(0);
  /** caught, but the day ended before it reached the developer */
  const [late, setLate] = useState<Severity[]>([]);
  const [shipped_, setShipped_] = useState<Severity[]>([]);
  /**
   * The day opens at home, so leaving for work is something the player does
   * rather than something that has already happened when they arrive.
   */
  const [place, setPlace] = useState<"office" | "home" | "street">(START_PLACE);
  /** true once the day has been signed off, which is what makes the bed work */
  const [dayOver, setDayOver] = useState(false);
  /** one coffee per commute */
  const [hadCoffee, setHadCoffee] = useState(false);
  /** how many people on the walk have been spoken to, so their lines rotate */
  const [greeted, setGreeted] = useState(0);
  /** minutes bought back today, and whether each offer has been taken */
  const [overtime, setOvertime] = useState(0);
  const [tookOvertime, setTookOvertime] = useState(false);
  const [tookFreeCoffee, setTookFreeCoffee] = useState(false);
  /** what the weekend was spent on, one thing per weekend day */
  const [workedWeekend, setWorkedWeekend] = useState(false);
  const [hobbyDone, setHobbyDone] = useState(false);
  /** an offer waiting on the player, drawn as a two-way prompt */
  const [offer, setOffer] = useState<null | "overtime" | "coffee">(null);
  const [watching, setWatching] = useState(false);
  /*
   * The first morning is a morning like the others: a night got you to three
   * of four. Starting at the top handed day one a fourth build for nothing,
   * and the one day that should teach the player what the coffee is for was
   * the only day they did not need it.
   */
  const [condition, setCondition] = useState(SLEEP_RECOVERY);
  /** points owed to tonight, from overtime or a weekend shift */
  const [borrowed, setBorrowed] = useState(0);
  /**
   * What one long stint takes out of the night, halved by a decent chair.
   *
   * The chair used to cancel the price of overtime outright, and overtime is
   * the reward for an advert — so in any build where the adverts are not there
   * to be watched, nothing ever borrowed, and a hundred and sixty won bought
   * an item that could not do anything. Half of any long stint is something it
   * can always be doing.
   */
  const borrowCost = () =>
    owned.includes("chair") ? BORROW_COST / 2 : BORROW_COST;
  /** a weekend spent on something else, cashed in on the next morning */
  const [earlyTomorrow, setEarlyTomorrow] = useState(false);
  /** one restful thing per evening */
  const [restedTonight, setRestedTonight] = useState(false);
  /** pay, earned by handing defects over, spent on equipment */
  const [pay, setPay] = useState(0);
  const [owned, setOwned] = useState<ItemId[]>([]);
  const [shop, setShop] = useState<null | "office" | "home">(null);
  /** where the player was standing on the office floor, across a build */
  const [officeAt, setOfficeAt] = useState<{ x: number; y: number } | null>(null);

  // one clock for the whole day, ticking through the office and the builds
  // alike; goHomeRef keeps the timer from closing over a stale day
  const goHomeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (shipped || dayOver || place === "home") return;
    const id = setInterval(() => {
      setMinutes((m) => {
        const end = DAY_END + overtime;
        if (m >= end) return m;
        const next = m + MINUTES_PER_SECOND / 4;
        if (next >= end) goHomeRef.current();
        return Math.min(next, end);
      });
    }, 250);
    return () => clearInterval(id);
    // `place` belongs in here: the effect read it once at mount and then never
    // again, so the clock ran on whatever the game had opened with. Starting the
    // day at home turned that from "time passes while you sleep" into "time
    // never passes at all".
  }, [shipped, place, dayOver, overtime]);

  /**
   * The office floor, with the player put back where they were standing.
   * Walking to a machine and stepping out of the build used to drop them in
   * the middle of the room, so a second look cost the whole walk again.
   */
  /** what the shoes are worth, applied to the three rooms the commute is in */
  const pace = owned.includes("shoes") ? SHOES_SPEED : 1;
  const officeHere = useMemo(
    () =>
      withSpeed(
        officeAt ? withPlayerAt(officeScene, officeAt.x, officeAt.y) : officeScene,
        pace
      ),
    [officeAt, pace]
  );

  /**
   * You arrive where you came in. Waking up puts you beside the bed; coming
   * back from the street puts you inside your own front door, and the street
   * puts you at whichever end you stepped out of.
   */
  const homeHere = useMemo(() => {
    const at = withPlayerAt(homeScene, dayOver ? 272 : 132, dayOver ? 545 : 258);
    if (!isWeekend(day)) return withSpeed(at, pace);
    // the same desk, doing the other thing it would obviously be doing
    return withSpeed({
      ...at,
      objects: at.objects.map((o) =>
        o.id === "homeScreen"
          ? {
              ...o,
              id: "hobby",
              nameKey: "object.hobby",
              // the screen is dressing on a working day and has no station of
              // its own; the weekend gives it one
              behaviors: [
                ...o.behaviors,
                { t: "station" as const, radius: 56, labelKey: "home.hobby" },
              ],
            }
          : o
      ),
    }, pace);
  }, [dayOver, day, pace]);
  const streetHere = useMemo(
    () => withSpeed(withPlayerAt(streetScene, 180, dayOver ? 250 : 540), pace),
    [dayOver, pace]
  );

  /*
   * One morning line, wherever the morning came from.
   *
   * Waking up worked out the weekend and the freeze; opening the game did
   * not, so the first screen of a Saturday told the player to get to work.
   * Two places deciding what today is will always end up disagreeing about it.
   */
  const morningFor = (d: number) =>
    isWeekend(d)
      ? t("home.morningWeekend")
      : isFreeze(d)
        ? tp("home.morningFreeze", { n: String(d) })
        : d === 1
          ? t("home.morningFirst")
          : tp("home.morning", { n: String(d) });
  const morningLine = () => morningFor(day);
  // said once on the first morning too, not only on the ones you wake up to
  useEffect(() => {
    setNote(morningLine());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenesById = useMemo(
    () => Object.fromEntries(ENGINE_SCENES.map((s) => [s.id, s])),
    []
  );

  const finish = (result: "caught" | "missed") => {
    if (!running) return;
    setLastResult(result);
    if (result === "caught") {
      setCaught((n) => n + 1);

      // and it goes in the pile waiting to be walked over to the developer.
      // Nothing ever went into that pile: a confirmed defect was counted and
      // then dropped, so the handoff never had anything to hand over, the
      // bounty was never paid, and with no pay the equipment could never be
      // bought. The whole economy was decorative.
      setPending((v) => [...v, { ...running, result }]);
    } else setMissed((n) => n + 1);
    /*
     * And into the book, which is the one thing that outlives the run. Only
     * builds that were opened: a defect that shipped because nobody had the
     * hours for it was never seen, and a book that counted it would be
     * recording the calendar rather than the player.
     */
    if (running.bugId) {
      recordBug(running.sceneId, running.bugId, result);
      queueSync(connected ? server : null);
    }
    /*
     * And once a day, from the second step on, they come and take it off you
     * rather than waiting at their desk. One walk saved out of however many
     * the day holds — enough to feel, not enough to make the office a menu.
     */
    if (result === "caught" && devLevel >= DEV_COMES_LEVEL && !devCame) {
      setDevCame(true);
      // only the one in their hand. Emptying the pile paid a single bounty for
      // however much was on the desk and threw the rest away.
      setPending((v) => v.filter((a) => a.machine !== running.machine));
      setPay((v) => v + bountyOf(running.severity));
      setDelivered((n) => n + 1);
      setNote(
        tp("office.dev.cameOver", { pay: String(bountyOf(running.severity)) })
      );
    }
    // charged here rather than on opening the machine, so backing out of a
    // build still costs nothing
    setCondition((c) => Math.max(0, c - INSPECT_COST));
    /*
     * A wrong report stands — the briefing says so two screens before the
     * player makes one, and it is the whole weight of the decision. The form
     * buys exactly one exception in a run: the build goes back on the machine
     * with a different defect in it, and the point of condition and the walk
     * are spent either way.
     */
    const retesting =
      result === "missed" && owned.includes("retest") && !retestUsed;
    if (retesting) {
      setRetestUsed(true);
      setNote(t("office.retested"));
    }
    setAssignments((as) =>
      as.map((a) =>
        a.machine === running.machine
          ? retesting
            ? { ...a, result: null, bugId: null }
            : { ...a, result }
          : a
      )
    );
    setRunning(null);
  };

  /**
   * Knocking off. Everything the day was going to cost is settled here — the
   * office is shut behind you — and then you are on the pavement outside it,
   * because the way home is the way you came.
   */
  const clockOff = () => {
    // anything still unverified ships as-is — except on a weekend, when the
    // build was never on the release train in the first place
    const unseen = assignments.filter((a) => a.result === null);
    setMissed((n) => n + unseen.length);
    if (!isWeekend(day)) {
      setShipped_((v) => [...v, ...unseen.map((a) => a.severity)]);
    }
    /*
     * A defect the developer never heard about does not get fixed — unless
     * they have started coming to find you.
     *
     * At the last step they take the worst one off your desk on their way out:
     * one report saved, paid for, and counted as handed over. Only one, so the
     * walk is still the job; what changes is that the day you ran out of time
     * costs you the second-worst thing rather than the worst.
     */
    let leaving: string | null = null;
    let owed = pending;
    if (devLevel >= DEV_COLLECT_LEVEL && owed.length) {
      const worst = owed.reduce(
        (best, a, i) =>
          SEVERITY_PIPS[a.severity] > SEVERITY_PIPS[owed[best].severity] ? i : best,
        0
      );
      const taken = owed[worst];
      owed = owed.filter((_, i) => i !== worst);
      setPay((v) => v + bountyOf(taken.severity));
      setDelivered((n) => n + 1);
      leaving = tp("office.dev.collected", { pay: String(bountyOf(taken.severity)) });
    }
    setLate((v) => [...v, ...owed.map((a) => a.severity)]);
    setPending([]);
    sfx.play("click");
    setRunning(null);
    // the line about what they took has to survive the walk out: clearing the
    // note unconditionally is what wiped the weekend one, twice
    setNote(leaving);
    // tomorrow starts at the door, not at yesterday's desk
    setOfficeAt(null);
    setDayOver(true);
    setPlace("street");
  };

  /** the bed, and the only way into tomorrow */
  const sleep = () => {
    if (day >= DAYS) {
      setShipped(true);
      return;
    }
    sfx.play("click");
    setNight(true);
    // the room is gone before it is rebuilt, so the change never shows
    window.setTimeout(wake, NIGHT_MS);
  };

  /** what actually turns the day over, once the screen is dark */
  const wake = () => {
    const next = day + 1;
    setDay(next);
    setAssignments(isWeekend(next) ? [] : assignDay(next));
    setWorkedWeekend(false);
    setHobbyDone(false);
    /*
     * An ordinary night gives everything back. A borrowed one caps how rested
     * it is possible to wake up.
     *
     * Taking it off the recovery instead let the ceiling swallow it: end a day
     * with points to spare, stay late anyway, and three plus one is still three
     * — the half hour was free for anyone who had not used the day it extended.
     * A night that was borrowed against is a worse night whatever was left in
     * the player when they started it.
     */
    setCondition((c) =>
      Math.max(0, Math.min(MAX_CONDITION - borrowed, c + SLEEP_RECOVERY))
    );
    setBorrowed(0);
    /*
     * The half hour a hobby buys waits for a morning that has work in it.
     *
     * It was spent on whatever morning came next, and the hobby is a weekend
     * thing — so a Saturday afternoon off bought a Sunday that started early,
     * on a day with no builds and no clock worth beating. What it says it buys
     * is Monday.
     */
    const toWork = !isWeekend(next);
    setMinutes(
      DAY_START -
        (owned.includes("alarm") ? ALARM_MINUTES : 0) -
        (earlyTomorrow && toWork ? ALARM_MINUTES : 0)
    );
    if (toWork) setEarlyTomorrow(false);
    setRestedTonight(false);
    setHadCoffee(false);
    setDevCoffee(false);
    setDevCame(false);
    setAteOut(false);
    setOvertime(0);
    setTookOvertime(false);
    setTookFreeCoffee(false);
    setDayOver(false);
    setPlace("home");
    window.setTimeout(() => setNight(false), 40);
    // the walk in is where the coffee is, and the fifteen minutes it costs is
    // the morning's one real decision — so the player has to make it, every
    // morning, by walking out of their own front door
    setNote(
      morningFor(next)
    );
  };
  /**
   * Six o'clock. If there are builds left unverified and the half hour has
   * not been taken today, the day pauses on the offer rather than ending —
   * which is the one moment the player most wants more of it. Declining, or
   * having nothing left to look at, knocks off as before.
   */
  const endOfDay = () => {
    const left = assignments.filter((a) => a.result === null).length;
    /*
     * Six o'clock, and the choice is the player's either way.
     *
     * The half hour used to exist only where an advert could be watched, so a
     * build without them had no overtime, nothing that ever borrowed against a
     * night, and a condition meter that read three every single morning. The
     * decision — is this build worth tomorrow — is the interesting part, and it
     * should not be gated on an ad network being reachable. What the advert
     * buys is the half hour for nothing, which is what a reward is.
     *
     * It is still worth nothing without the condition left to open a machine
     * with, so that one state does not raise it.
     */
    if (left > 0 && condition >= INSPECT_COST && !tookOvertime) {
      setOffer("overtime");
      return;
    }
    clockOff();
  };
  goHomeRef.current = endOfDay;

  /** the coffee as it has always been bought: with a quarter of an hour */
  const payForCoffee = () => {
    setHadCoffee(true);
    setCondition((c) => Math.min(MAX_CONDITION, c + 1));
    // a flask filled at home is the same cup without the queue for it
    const spent = owned.includes("thermos") ? THERMOS_MINUTES : COFFEE_MINUTES;
    setMinutes((m) => Math.min(DAY_END + overtime, m + spent));
    sfx.play("pick");
    setNote(tp("street.gotCoffee", { n: String(spent) }));
  };

  /** the half hour as it is bought without an advert: against tonight */
  const stayLate = () => {
    setOffer(null);
    setTookOvertime(true);
    setOvertime((o) => o + OVERTIME_MINUTES);
    setBorrowed((b) => b + borrowCost());
    // the night is not the only thing it comes out of
    setSpirit((v) => Math.max(0, v - 1));
    sfx.play("click");
    setNote(tp("office.stayedLate", { n: String(OVERTIME_MINUTES) }));
  };

  /** the reward, once the ad has actually run to the end */
  const takeOffer = async (kind: "overtime" | "coffee") => {
    setWatching(true);
    const done = await showRewarded(kind);
    setWatching(false);
    setOffer(null);
    if (!done) {
      // A dismissed advert earns nothing and decides nothing. It used to send
      // the player home, from a prompt whose whole point is that going home is
      // one of three answers — so the prompt comes back instead.
      setOffer(kind);
      return;
    }
    if (kind === "overtime") {
      setTookOvertime(true);
      setOvertime((o) => o + OVERTIME_MINUTES);
      sfx.play("success");
      return;
    }
    setTookFreeCoffee(true);
    setHadCoffee(true);
    setCondition((c) => Math.min(MAX_CONDITION, c + 1));
    sfx.play("pick");
    setNote(t("street.freeCoffee"));
  };

  /**
   * What the developer says, most pressing first. Reacting to the build you
   * just signed off matters more than the day, and the day matters more than
   * small talk — otherwise the same line comes back and they stop reading it.
   */
  const devLevel = devLevelFor(delivered);
  /** a bounty, at whatever the day it was earned on is paying */
  const bountyOf = (sv: Severity, on: number = day) =>
    Math.round(BOUNTY[sv] * (isFreeze(on) ? FREEZE_PAY : 1));

  const devLine = () => {
      if (day === 1 && talks === 0) return "office.dev.intro";
    if (pending.length) return "office.dev.waiting";
    if (lastResult === "caught") return "office.dev.caught";
    if (lastResult === "missed") return "office.dev.missed";
    if (left === 0) return "office.dev.allDone";
    if (day >= DAYS) return "office.dev.lastDay";
    // the small talk is where the change is felt, so it belongs to the level
    // rather than to the number of times you have said hello
    if (devLevel > 0) return `office.dev.warm${devLevel}_${talks % 2}`;
    return `office.dev.idle${talks % IDLE_LINES}`;
  };

  const buy = (item: ItemId, cost: number) => {
    if (owned.includes(item) || pay < cost) return;
    setPay((p) => p - cost);
    setOwned((o) => [...o, item]);
    sfx.play("success");
  };

  const onStreetStation = (id: string) => {
    if (id === "officeDoor") {
      if (dayOver) return setNote(t("street.shut"));
      if (isWeekend(day) && !workedWeekend) return setNote(t("street.weekend"));
      sfx.play("click");
      setPlace("office");
      setNote(null);
      return;
    }
    if (id.startsWith("passer")) {
      setNote(t(`street.passer${greeted % PASSER_LINES}`));
      setGreeted((n) => n + 1);
      return;
    }
    if (id === "homeDoor") {
      sfx.play("click");
      setNote(null);
      setPlace("home");
      return;
    }
    if (id === "pocha") {
      // shut in the morning, and not a second sofa: what it buys is the only
      // thing money buys in this game that is not equipment
      if (!dayOver) return setNote(t("street.pochaShut"));
      if (ateOut) return setNote(t("street.pochaDone"));
      if (spirit >= MAX_SPIRIT) return setNote(t("street.pochaFine"));
      if (pay < POCHA_PAY) {
        return setNote(tp("street.pochaBroke", { n: String(POCHA_PAY) }));
      }
      setAteOut(true);
      setPay((v) => v - POCHA_PAY);
      setSpirit((v) => Math.min(MAX_SPIRIT, v + 1));
      sfx.play("pick");
      return setNote(tp("street.pochaAte", { n: String(POCHA_PAY) }));
    }
    if (id === "coffee") {
      if (dayOver) return setNote(t("street.shut"));
      if (hadCoffee) return setNote(t("street.hadCoffee"));
      // fifteen minutes for nothing is a trap, not a decision
      if (condition >= MAX_CONDITION) return setNote(t("common.alreadyFine"));
      /*
       * Always ask. Where the adverts were reachable the machine put up a
       * prompt; where they were not it took the quarter of an hour on the press,
       * so walking into the vending machine on the way past cost a sixth of the
       * morning with nothing asked and nothing to undo.
       */
      return setOffer("coffee");
    }
  };

  const onHomeStation = (id: string) => {
    if (id === "bed") {
      if (!dayOver) return setNote(t("home.tooEarly"));
      return sleep();
    }
    if (id === "sofa") {
      // an evening in front of the television does not add anything to a day
      // that was not overdrawn — it settles one that was
      if (!borrowed) return setNote(t("home.nothingOwed"));
      if (restedTonight) return setNote(t("home.alreadyRested"));
      setRestedTonight(true);
      setBorrowed((b) => Math.max(0, b - 1));
      sfx.play("pick");
      return setNote(t("home.rested"));
    }
    if (id === "hobby") {
      // pay turned into a mood: the only thing money buys that the shop does
      // not, and the reason a quiet Saturday is worth something
      if (hobbyDone) return setNote(t("home.hobbyDone"));
      if (pay < HOBBY_PAY) return setNote(tp("home.hobbyBroke", { n: String(HOBBY_PAY) }));
      setHobbyDone(true);
      setPay((p) => p - HOBBY_PAY);
      // The sofa settles one borrowed night for nothing, so clearing the debt
      // cannot be all this buys or it is a paid copy of a free thing. What it
      // buys that nothing else does is the half hour off Monday morning — the
      // one part of a weekend that is still there on the Monday.
      setCondition(MAX_CONDITION);
      setBorrowed(0);
      setEarlyTomorrow(true);
      sfx.play("pick");
      return setNote(tp("home.hobbyDid", { n: String(HOBBY_PAY) }));
    }
    if (id === "journal") {
      sfx.play("click");
      setCodex(true);
      return;
    }
    if (id === "parcel") {
      sfx.play("click");
      setShop("home");
      return;
    }
    if (id === "frontDoor") {
      if (dayOver) return setNote(t("home.notYet"));
      if (isWeekend(day) && !workedWeekend) {
        // nothing has gone out yet, so there is nothing to come in for
        if (!shipped_.length) return setNote(t("home.nothingToFix"));
        // one machine, and a night of the week you are borrowing it from.
        // Catching up this week is what breaks the next one.
        setWorkedWeekend(true);
        setAssignments(
          assignDay(day, [MACHINES[0]]).map((a) => ({ ...a, hotfix: true }))
        );
        setBorrowed((b) => b + borrowCost());
    // the night is not the only thing it comes out of
    setSpirit((v) => Math.max(0, v - 1));
        // and stop here. Walking straight out wiped the line explaining what
        // the point of condition had just been spent on; the door opens on
        // the next press, once it has been read.
        return setNote(t("home.wentInAnyway"));
      }
      sfx.play("click");
      setNote(null);
      setPlace("street");
      return;
    }
  };

  const onStation = (id: string) => {
    if (id === "exitDoor") {
      clockOff();
      return;
    }
    if (id === "supplyForm") {
      sfx.play("click");
      setShop("office");
      return;
    }
    if (id === "dev") {
      if (pending.length) {
        const earned = pending.reduce((sum, a) => sum + bountyOf(a.severity), 0);
        // every hotfix handed over pulls back the worst thing that got out
        const fixes = pending.filter((a) => a.hotfix).length;
        if (fixes) {
          setShipped_((v) => {
            const left = [...v];
            for (let i = 0; i < fixes && left.length; i++) {
              const worst = left.reduce(
                (best, sv, k) =>
                  SEVERITY_PIPS[sv] > SEVERITY_PIPS[left[best]] ? k : best,
                0
              );
              left.splice(worst, 1);
            }
            return left;
          });
        }
        setPay((p) => p + earned);
        setDelivered((n) => n + pending.length);
        setPending([]);
        /*
         * Crossing a step is the news. What the handoff paid is already in the
         * bar above, and a relationship that changed what the day can do
         * without saying so is one the player never finds out they have.
         */
        const stepped = devLevelFor(delivered + pending.length);
        setNote(
          stepped > devLevel
            ? t(`office.dev.step${stepped}`)
            : tp("office.dev.handoff", {
                n: String(pending.length),
                pay: String(earned),
              })
        );
        setTalks((n) => n + 1);
        setLastResult(null);
        return;
      }
      /*
       * The cup on their desk. It is the same point of condition the machine
       * on the walk in sells for a quarter of an hour, except a colleague who
       * knows you does not charge you the quarter of an hour — and the fourth
       * machine is exactly one point out of reach.
       */
      if (
        devLevel >= DEV_COFFEE_LEVEL &&
        !devCoffee &&
        !dayOver &&
        condition < MAX_CONDITION
      ) {
        setDevCoffee(true);
        setCondition((c) => Math.min(MAX_CONDITION, c + 1));
        sfx.play("pick");
        setNote(t("office.dev.coffee"));
        setTalks((n) => n + 1);
        setLastResult(null);
        return;
      }
      setNote(t(devLine()));
      setTalks((n) => n + 1);
      setLastResult(null);
      return;
    }
    const a = assignments.find((x) => x.machine === id);
    if (!a) return;
    if (a.result !== null) {
      setNote(t("office.alreadyDone"));
      return;
    }
    // nothing left to look with. The coffee is the way back in, and after
    // that the door is.
    if (condition < INSPECT_COST) return setNote(t("office.tooTired"));
    setRunning(a);
  };

  if (shipped) {
    const total = caught + missed;
    /*
     * Everything the run put on the line, read off the plan itself rather than
     * from one day multiplied out — the freeze means the days are no longer
     * interchangeable, and a share of the wrong total is the wrong rating.
     */
    const stake = WORK_DAYS.reduce(
      (sum, d) => sum + totalStake(1, assignDay(d).map((a) => a.severity)),
      0
    );
    const rating = shipRating(shipped_, late, stake);
    /*
     * The run is over, so the account hears about it once. Written straight
     * into the render rather than an effect because this screen is terminal —
     * there is no next state for an effect to belong to, and the guard is the
     * ref rather than a dependency array.
     */
    if (!runReported.current) {
      runReported.current = true;
      void reportRun(connected ? server : null, rating);
      void syncBook(server);
    }
    return (
      <div className="wb-root wb-ship">
        <h1>{t("office.shipTitle")}</h1>
        <div className="wb-rating">
          <span className="wb-stars">
            {/* floored, so five stars means the build shipped clean and
                nothing rounds its way up to a perfect score */}
            {"★".repeat(Math.floor(rating))}
            {"☆".repeat(5 - Math.floor(rating))}
          </span>
          <b>{rating.toFixed(1)}</b>
        </div>
        <p className="wb-tally">
          {tp("office.tally", { caught: String(caught), total: String(total) })}
          <br />
          {tp("office.tallyDetail", {
            delivered: String(delivered),
            late: String(late.length),
            critical: String(shipped_.filter((s2) => s2 === "critical").length),
          })}
        </p>
        {/*
          Two numbers, not one. The stars are what the company got out of the
          twelve days; this is what they cost the person who worked them, and a
          run can be excellent at one and dreadful at the other.
        */}
        <p className="wb-tally wb-spirit">
          {"♥".repeat(spirit)}
          {"♡".repeat(MAX_SPIRIT - spirit)}{" "}
          {t(`spirit.end${spirit >= 4 ? "High" : spirit >= 2 ? "Mid" : "Low"}`)}
        </p>
        {(() => {
          const book = codexTally(codexRows());
          return (
            <p className="wb-tally wb-book">
              {tp("codex.shipLine", {
                caught: String(book.caught),
                total: String(book.total),
                fresh: String(Math.max(0, book.caught - codexAtStart)),
              })}
            </p>
          );
        })()}
        <button className="btn-primary" onClick={onExit}>
          {t("wb.backToTitle")}
        </button>
      </div>
    );
  }

  if (running) {
    /*
     * What every build is handed, whichever component draws it: it keeps the
     * defect it was given so walking away and back finds the same one, a wrong
     * report stands exactly as the briefing says it will, and the arrow means
     * "step away" rather than "sign this off" — the clock running while you
     * walk is the only price of a second look.
     */
    const build = {
      key: `${day}-${running.machine}`,
      title: `${tp("office.buildTitle", { machine: t(`object.${running.machine}`) })} · ${clock(minutes)}`,
      bugId: running.bugId,
      onBugPicked: (id: string) => {
        setAssignments((as) =>
          as.map((a) =>
            a.machine === running.machine ? { ...a, bugId: id } : a
          )
        );
        // and on the build in hand, which is a snapshot taken when the
        // machine opened — the book is written from it, and without this it
        // was still holding the null it was opened with
        setRunning((r) => (r ? { ...r, bugId: id } : r));
      },
      onClear: () => finish("caught"),
      onFail: () => finish("missed"),
      onExit: () => setRunning(null),
    };
    if (running.sceneId === "stage04") {
      return (
        <Stage04
          key={build.key}
          stageNo={day}
          title={build.title}
          playtest={PLAYTEST}
          bugId={build.bugId}
          onBugPicked={build.onBugPicked}
          onClear={build.onClear}
          onFail={build.onFail}
          onExit={build.onExit}
        />
      );
    }
    const scene = scenesById[running.sceneId];
    return (
      <EngineStage
        key={build.key}
        scene={scene}
        stageNo={day}
        title={build.title}
        canZoom={owned.includes("magnifier")}
        playtest={PLAYTEST}
        bugId={build.bugId}
        onBugPicked={build.onBugPicked}
        onClear={build.onClear}
        onFail={build.onFail}
        onExit={build.onExit}
      />
    );
  }

  const left = assignments.filter((a) => a.result === null).length;
  const sky = skyAt(minutes);

  return (
    <div
      className="wb-root"
      style={
        {
          "--lamp": String(lampAt(minutes)),
          "--sky-top": sky.top,
          "--sky-bottom": sky.bottom,
        } as CSSProperties
      }
    >
      {place === "street" ? (
        <EngineStage
          key={`street-${day}`}
          scene={streetHere}
          mode="play"
          header={
            <div className="wb-header">
              <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
                ←
              </button>
              <span className="wb-build">
              {tp("office.day", { n: String(day) })} {t(dayName(day))}
            </span>
              <span className="office-clock">{clock(minutes)}</span>
              <span className="office-condition">
                {t("home.condition")} {"●".repeat(condition)}
                {"○".repeat(MAX_CONDITION - condition)}
              </span>
              {/* the other half of what the twelve days are making */}
              <span className="office-spirit" title={t("spirit.name")}>
                {"♥".repeat(spirit)}
                {"♡".repeat(MAX_SPIRIT - spirit)}
              </span>
            </div>
          }
          onStation={onStreetStation}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : place === "home" ? (
        <EngineStage
          key={`home-${day}`}
          scene={homeHere}
          mode="play"
          header={
            <div className="wb-header">
              <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
                ←
              </button>
              <span className="wb-build">
                {tp(dayOver ? "home.evening" : "home.morningHeader", {
                  n: String(day),
                })}{" "}
                {t(dayName(day))}
              </span>
              <span className="office-condition">
                {t("home.condition")} {"●".repeat(condition)}
                {"○".repeat(MAX_CONDITION - condition)}
              </span>
              {/* the other half of what the twelve days are making */}
              <span className="office-spirit" title={t("spirit.name")}>
                {"♥".repeat(spirit)}
                {"♡".repeat(MAX_SPIRIT - spirit)}
              </span>
            </div>
          }
          onStation={onHomeStation}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : (
      <EngineStage
        key={`office-${day}`}
        scene={officeHere}
        mode="play"
        onPlayerRest={setOfficeAt}
        header={
          <div className="wb-header">
            <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
              ←
            </button>
            {/* one date, not two: which day this is and how many are left are
                the same fact read from opposite ends, and each was taking its
                own slot on a bar 360 wide */}
            {/* the last two days are a different kind of day and the bar has
                to say so before the player opens a machine and finds out */}
            <span className={`wb-deadline ${isFreeze(day) ? "freeze" : ""}`}>
              {tp(isFreeze(day) ? "office.dayFreeze" : "office.dayShip", {
                n: String(day),
                left: String(DAYS - day),
              })}
            </span>
            <span className="office-clock">{clock(minutes)}</span>
            {/*
              The one number the day is actually rationed by. It was drawn only
              at home, where none of it gets spent — and then, once it was up
              here, three dots with nothing to say what they counted. Both this
              and the queue answer when pressed, because a phone has no tooltip
              and the bar has no room for a legend.
            */}
            <button
              type="button"
              className="office-condition hud-ask"
              onClick={() =>
                setNote(tp("office.whatCondition", { n: String(condition) }))
              }
            >
              <EyeIcon />
              {"●".repeat(condition)}
              {"○".repeat(MAX_CONDITION - condition)}
            </button>
            <span className="office-pay">{tp("office.pay", { n: String(pay) })}</span>
            <span className="office-queue">
              {assignments.map((a) => (
                <b
                  key={a.machine}
                  className={`q-${a.severity} ${a.result ? "done" : ""} hud-ask`}
                  title={`${t(`object.${a.machine}`)} · ${t(`office.sev.${a.severity}`)}`}
                  onClick={() =>
                    setNote(
                      tp(a.result ? "office.whatChipDone" : "office.whatChip", {
                        machine: t(`object.${a.machine}`),
                        sev: t(`office.sev.${a.severity}`),
                      })
                    )
                  }
                >
                  {a.machine.slice(-1)}
                  {/* how bad this one would be, in pips. The colour said it
                      and the tooltip said it, and a phone has no tooltip and
                      no legend for the colour — so the one decision the day
                      turns on, which machine to reach first, was unreadable */}
                  <i>{"·".repeat(SEVERITY_PIPS[a.severity])}</i>
                </b>
              ))}
              {pending.length > 0 && (
                <em className="q-pending">{tp("office.pending", { n: String(pending.length) })}</em>
              )}
            </span>
          </div>
        }
        onStation={onStation}
        onClear={() => {}}
        onExit={onExit}
      />
      )}

      {/*
        * Language and sound. They used to live on the title screen, which no
        * longer exists — so they sit in the corner of the floor instead,
        * small enough to ignore and gone while a build is running.
        */}
      <div className="floor-controls">
        <Settings />
      </div>

      {offer && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{t(`offer.${offer}.title`)}</h2>
            <p>{t(`offer.${offer}.body`)}</p>
            <div className="modal-actions">
              <button
                data-space
                className="btn-ghost"
                disabled={watching}
                onClick={() => {
                  const kind = offer;
                  setOffer(null);
                  // saying no at six o'clock is knocking off; at the machine it
                  // is walking past it
                  if (kind === "overtime") clockOff();
                }}
              >
                {t(`offer.${offer}.no`)}
              </button>
              <button
                className="btn-primary"
                disabled={watching}
                onClick={() => {
                  if (offer === "overtime") return stayLate();
                  setOffer(null);
                  payForCoffee();
                }}
              >
                {watching ? t("offer.watching") : t(`offer.${offer}.yes`)}
              </button>
            </div>
            {/*
              The advert is the third way out, not the door itself: going home
              and staying late are both there without it. Space goes home,
              because that is the answer that costs nothing.
            */}
            {adsAvailable() &&
              (offer === "overtime" || !tookFreeCoffee) && (
                <button
                  className="offer-free"
                  disabled={watching}
                  onClick={() => takeOffer(offer)}
                >
                  {watching ? t("offer.watching") : t(`offer.${offer}.free`)}
                </button>
              )}
          </div>
        </div>
      )}

      {codex && (
        <div className="modal-backdrop" onClick={() => setCodex(false)}>
          <div className="modal codex" onClick={(e) => e.stopPropagation()}>
            <h2>{t("codex.title")}</h2>
            {/* the line the journal used to print on its own: where the run is,
                which is the other thing you open a notebook to check */}
            <p className="codex-where">
              {tp("codex.dev", {
                pips:
                  "●".repeat(devLevel) +
                  "○".repeat(DEV_STEPS.length - devLevel),
                n: String(delivered),
              })}
              <br />
              {tp("home.journalLine", {
                n: String(day),
                left: String(DAYS - day),
                shipped: String(shipped_.length),
              })}
            </p>
            {(() => {
              const rows = codexRows();
              const tally = codexTally(rows);
              const byScene = new Map<string, typeof rows>();
              for (const r of rows) {
                byScene.set(r.sceneId, [...(byScene.get(r.sceneId) ?? []), r]);
              }
              return (
                <>
                  <p className="codex-tally">
                    {tp("codex.tally", {
                      caught: String(tally.caught),
                      total: String(tally.total),
                      missed: String(tally.missed),
                    })}
                  </p>
                  <div className="codex-list">
                    {[...byScene].map(([sceneId, list]) => (
                      <section key={sceneId}>
                        <h3>
                          {t(`stage.${sceneId}.name`)}
                          <b>
                            {list.filter((r) => r.state === "caught").length}/
                            {list.length}
                          </b>
                        </h3>
                        {/*
                          Only what has been met gets a line. A hundred and
                          twenty-one repetitions of "not met yet" is not a
                          collection, it is a wall — the empty ones say how
                          many are left the way empty shelves do, in a row of
                          slots you can take in at a glance.
                        */}
                        <div className="codex-rows">
                          {list
                            .filter((r) => r.state !== "unseen")
                            .map((r) => (
                              <span
                                key={r.bugId}
                                className={`codex-row ${r.state}`}
                              >
                                {tp(r.descKey, {
                                  ...r.descParams,
                                  obj: t(r.descParams.obj ?? ""),
                                })}
                              </span>
                            ))}
                          {(() => {
                            const left = list.filter(
                              (r) => r.state === "unseen"
                            ).length;
                            if (!left) return null;
                            return (
                              <span
                                className="codex-slots"
                                title={tp("codex.left", { n: String(left) })}
                              >
                                {"▫".repeat(left)}
                              </span>
                            );
                          })()}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="modal-actions">
              <button
                data-space
                className="btn-primary"
                onClick={() => setCodex(false)}
              >
                {t("wb.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {shop && (
        <div className="modal-backdrop" onClick={() => setShop(null)}>
          <div className="modal shop" onClick={(e) => e.stopPropagation()}>
            <h2>{t(`shop.title.${shop}`)}</h2>
            <p className="shop-pay">{tp("office.pay", { n: String(pay) })}</p>
            <div className="shop-list">
              {CATALOGUE.filter((c) => c.where === shop).map((c) => {
                const have = owned.includes(c.id);
                const canAfford = pay >= c.cost;
                return (
                  <button
                    key={c.id}
                    className={`shop-item ${have ? "have" : ""}`}
                    disabled={have || !canAfford}
                    onClick={() => buy(c.id, c.cost)}
                  >
                    <span className="shop-name">{t(`item.${c.id}`)}</span>
                    <span className="shop-desc">{t(`item.${c.id}.desc`)}</span>
                    <em>{have ? t("shop.have") : tp("office.pay", { n: String(c.cost) })}</em>
                  </button>
                );
              })}
            </div>
            <button data-space className="btn-primary" onClick={() => setShop(null)}>
              {t("wb.close")}
            </button>
          </div>
        </div>
      )}

      {note && (
        <div className="modal-backdrop" onClick={() => setNote(null)}>
          <div className="modal">
            <p>{note}</p>
            <button data-space className="btn-primary" onClick={() => setNote(null)}>
              {t("wb.close")}
              {HAS_KEYBOARD && <em className="key-hint">space</em>}
            </button>
          </div>
        </div>
      )}
      {/* over the whole frame, modals included: the morning line belongs to
          the new day and should not be readable through the old room */}
      <div className={`night ${night ? "on" : ""}`} />
    </div>
  );
}
