import { devParam, devFlag } from "../dev";
import { recordBug, codexRows, codexTally, loadCodex } from "./codex";
import { syncBook, syncYears, queueSync, reportRun, settleOwedReset } from "../net/save";
import { loadEntitlements, useAdsRemoved } from "../net/shop";
import { useGameServer } from "@agent8/gameserver";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import type { SceneSpec } from "../engine/types";
import { officeScene, MACHINES } from "./scene";
import { homeScene } from "../home/scene";
import { streetScene } from "../street/scene";
import { laneScene } from "../street/lane";
import { PASSERS, passerLine } from "../street/passers";
import { pochaLine } from "../street/pocha";
import { devLine, devShipLine } from "./devlines";
import { DINNER_SPIRIT, HOTFIX_CONDITION, isDinner, isHotfix } from "./events";
import { ENGINE_SCENES, SCENE_BY_ID } from "../stages/registry";
import { assignDay, buildIdsFor, isFreeze, LATER_BUILDS } from "./schedule";
import { addYear, loadYears, newRunId, recordBest, yearOf } from "./years";
import { buildProgress, masteredBuilds, preferFor } from "./mastery";
import { Stage04 } from "../stages/stage04/Stage04";
import { sfx } from "../audio/sfx";
import { music } from "../audio/music";
import { shipRating, totalStake, type Severity } from "./rating";
import {
  readRun,
  fetchRun,
  newer,
  saveRun,
  clearRun,
  type Assignment,
  type ItemId,
  type Place,
  type Arrival,
  type RunSnapshot,
  type RunFields,
  type GiftId,
  GIFTS,
} from "./run";
import { Loading } from "../components/Loading";
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
 * At 2.3 that same pace has the fourth build done around a quarter past five,
 * which leaves the end of the afternoon worth something without making the day
 * a race — and a player slower than that meets six o'clock with work left,
 * which is the decision the evening economy is made of. The day is a little
 * under four real minutes.
 */
const MINUTES_PER_SECOND = 2.3;

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
  return asked === "office" || asked === "street" || asked === "lane"
    ? asked
    : "home";
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

/**
 * What a coffee on the way in costs, and what it is worth.
 *
 * An hour, not the quarter it was. A quarter of an hour bought a whole extra
 * build for almost nothing, which made the cup the obvious move every single
 * morning and therefore not a decision. An hour is a real trade: the fourth
 * build only fits if the first three went quickly.
 */
const COFFEE_MINUTES = 60;

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

/** what each thing costs, and which of the two shops has it */
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
/**
 * What a coffee costs once you are not queueing at the machine for it.
 *
 * A third of the price, which is the ratio it has always been — the flask
 * skips the queue, it does not skip the drinking.
 */
const THERMOS_MINUTES = 20;

/** the alarm clock starts the day this much earlier */
const ALARM_MINUTES = 30;


/**
 * The QA floor, replacing the stage-select grid.
 *
 * The verification itself is unchanged — the same scene, the same planted
 * defect, the same report. What changes is the frame around it: builds are
 * queued on machines you walk to, a day holds only so many, and the ship date
 * arrives whether or not the queue is clear.
 */
/** how long a boot waits for the account before going with what is here */
const BOOT_WAIT_MS = 2000;

/**
 * Which run to start from, decided once, before anything can play.
 *
 * It has to happen outside the component that holds the state. A useState
 * initialiser runs at mount and never again, so a snapshot that arrives later
 * cannot fill in the thirty-six of them — the choice must already be made by
 * the time OfficeRun exists, which is why this is a separate component and
 * not an effect inside it.
 *
 * The device's copy is read synchronously and is the answer if nothing better
 * turns up. The account is asked in parallel and wins only by being newer;
 * two seconds is the whole of its chance, after which a slow or missing
 * server costs the player nothing but a wait they were already having. The
 * decision is made once and never revisited: a date that changes underneath
 * somebody mid-run reads as a fault whatever the reason for it.
 *
 * A dev query string skips all of it. "?day=7" means "show me day seven",
 * and resuming over the top of that would make the tool useless.
 */
export function Office({ onExit }: { onExit: () => void }) {
  const { server, connected } = useGameServer();
  const [boot, setBoot] = useState<RunSnapshot | null | undefined>(
    devParam("day") || devParam("place") || devParam("at") ? null : undefined
  );
  const settled = useRef(false);

  useEffect(() => {
    if (boot !== undefined || settled.current) return;
    const local = readRun();
    const done = (found: RunSnapshot | null) => {
      if (settled.current) return;
      settled.current = true;
      setBoot(found);
    };
    const timer = window.setTimeout(() => done(local), BOOT_WAIT_MS);
    if (connected) {
      void (async () => {
        /*
         * A wipe asked for just before a reload is still owed here, and the
         * account still holds the run it threw away. Carry the wipe out
         * before asking the account for anything; if it cannot be carried
         * out, go with this device, which the wipe has already emptied.
         */
        if (!(await settleOwedReset(server))) {
          clearTimeout(timer);
          done(local);
          return;
        }
        const remote = await fetchRun(server);
        clearTimeout(timer);
        done(newer(local, remote));
      })();
    }
    return () => clearTimeout(timer);
  }, [boot, connected, server]);

  if (boot === undefined) return <Loading progress={1} />;
  return <OfficeRun boot={boot} onExit={onExit} />;
}

function OfficeRun({
  boot,
  onExit,
}: {
  boot: RunSnapshot | null;
  onExit: () => void;
}) {
  const { t, tp } = useI18n();
  const [day, setDay] = useState(boot?.day ?? START_DAY);
  /** this run's id, fixed for its lifetime */
  const [runId] = useState(() => boot?.runId ?? newRunId());
  /**
   * The year this run belongs to. A saved run from before years existed has
   * none and is year one; a fresh run is whatever this device has finished.
   */
  const [yearAtStart] = useState(
    () => boot?.yearAtStart ?? (boot ? 1 : yearOf(loadYears()))
  );
  /** the first morning's gift, once picked */
  const [gift, setGift] = useState<GiftId | null>(boot?.gift ?? null);
  const builds = useMemo(() => buildIdsFor(yearAtStart), [yearAtStart]);
  /** a run from year two on hands over one thing before its first morning */
  const giftOwed = yearAtStart >= 2 && gift === null;
  const [assignments, setAssignments] = useState<Assignment[]>(
    () =>
      boot?.assignments ??
      (isWeekend(boot?.day ?? START_DAY)
        ? []
        : assignDay(boot?.day ?? START_DAY, builds, MACHINES))
  );
  const [running, setRunning] = useState<Assignment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** whether the developer has already made you one today */
  const [devCoffee, setDevCoffee] = useState(boot?.devCoffee ?? false);
  /** whether they have already walked over to collect today */
  const [devCame, setDevCame] = useState(boot?.devCame ?? false);
  /** the one re-test the form buys, spent once in a run */
  const [retestUsed, setRetestUsed] = useState(boot?.retestUsed ?? false);
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
  const [spirit, setSpirit] = useState(boot?.spirit ?? SPIRIT_START);
  /** the stall serves once a night */
  const [ateOut, setAteOut] = useState(boot?.ateOut ?? false);
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
    if (!connected) return;
    void syncBook(server);
    void syncYears(server);
  }, [connected, server]);

  /*
   * What the account has bought. Read separately from the book, because a
   * failed sync must not be able to lose a purchase.
   */
  const adsRemoved = useAdsRemoved();
  useEffect(() => {
    if (connected) void loadEntitlements(server);
  }, [connected, server]);

  /** so a re-render of the terminal screen does not count the run twice */
  const runReported = useRef(false);
  // the best rating from before this run shipped, read once when it does
  const bestBefore = useRef<number | null>(null);
  const [codexAtStart] = useState(
    () => boot?.codexAtStart ?? codexTally(codexRows(undefined, yearAtStart)).caught
  );
  /*
   * The book as rows, worked out once rather than on every tick of the clock:
   * a hundred and fifty faults are generated to build it. It moves when a
   * build closes (running), when a day turns, and when the account's copy may
   * have come down (connected).
   */
  const bookRows = useMemo(
    () => codexRows(undefined, yearAtStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yearAtStart, running, day, connected]
  );
  const mastered = useMemo(() => masteredBuilds(bookRows), [bookRows]);
  /** the build on screen was mastered when it was opened, so it costs nothing */
  const [runningFree, setRunningFree] = useState(false);
  /** a build can be opened now: it is mastered, or there is condition to spend */
  const canOpen = (a: Assignment) =>
    a.result === null && (mastered.includes(a.sceneId) || condition >= INSPECT_COST);
  // what was mastered when the run began, so the ship screen can say what is new
  const [masteredAtStart] = useState<string[]>(
    () => boot?.masteredAtStart ?? masteredBuilds(codexRows(undefined, yearAtStart))
  );
  const [shipped, setShipped] = useState(false);
  const [caught, setCaught] = useState(boot?.caught ?? 0);
  const [missed, setMissed] = useState(boot?.missed ?? 0);
  const [minutes, setMinutes] = useState(
    boot?.minutes ?? START_AT ?? DAY_START
  );
  /** how many times the developer has been spoken to, so idle lines rotate */
  const [talks, setTalks] = useState(boot?.talks ?? 0);
  /** the last build signed off, so the developer can react to it once */
  const [lastResult, setLastResult] = useState<null | "caught" | "missed">(
    boot?.lastResult ?? null
  );
  /** caught today but not yet handed to the developer */
  const [pending, setPending] = useState<Assignment[]>(boot?.pending ?? []);
  const [delivered, setDelivered] = useState(boot?.delivered ?? 0);
  /** caught, but the day ended before it reached the developer */
  const [late, setLate] = useState<Severity[]>(boot?.late ?? []);
  const [shipped_, setShipped_] = useState<Severity[]>(boot?.shipped_ ?? []);
  /**
   * The day opens at home, so leaving for work is something the player does
   * rather than something that has already happened when they arrive.
   */
  const [place, setPlace] = useState<Place>(boot?.place ?? START_PLACE);

  /*
   * Music belongs to the parts of the day that are not work.
   *
   * The walk and the flat have it; the floor and the builds opened from it
   * do not. Looking for a defect means watching for something that stopped
   * moving or a sound that did not come, and a tune over the top of that is
   * the game arguing with its own subject. The builds need no case of their
   * own — they are opened while place is "office", so they are already
   * silent, and so is the shipping screen, which is why the last cue of the
   * run lands in the clear.
   */
  useEffect(() => {
    music.wants(place === "home" || place === "lane" || place === "street");
  }, [place]);

  /*
   * The first sound a browser allows is one that follows a press. The music
   * wants to start in a bedroom nobody has touched, so it asks again after
   * anything the player does.
   */
  useEffect(() => {
    const wake = () => music.nudge();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);
  /**
   * Which way you came in, so every room puts you back at the door you used.
   *
   * Two screens of street ago the answer was derivable — before six you were
   * walking to work, after it you were walking home — and with a block, a
   * street and two ends to each of them it is not: going back out of your own
   * front door for something you forgot dropped you at the far kerb. The
   * arrival is a fact now, recorded where it happens.
   */
  const [from, setFrom] = useState<Arrival>(boot?.from ?? "wake");
  /** one move between rooms: where to, and which door it came out of */
  const go = (to: Place, via: Arrival) => {
    setFrom(via);
    setPlace(to);
  };
  /** true once the day has been signed off, which is what makes the bed work */
  const [dayOver, setDayOver] = useState(boot?.dayOver ?? false);
  /** one coffee per commute */
  const [hadCoffee, setHadCoffee] = useState(boot?.hadCoffee ?? false);
  /** how many people on the walk have been spoken to, so their lines rotate */
  /** how many times each of them has been spoken to, by object id */
  const [greeted, setGreeted] = useState<Record<string, number>>(
    boot?.greeted ?? {}
  );
  /** minutes bought back today, and whether each offer has been taken */
  const [overtime, setOvertime] = useState(boot?.overtime ?? 0);
  const [tookOvertime, setTookOvertime] = useState(
    boot?.tookOvertime ?? false
  );
  const [tookFreeCoffee, setTookFreeCoffee] = useState(
    boot?.tookFreeCoffee ?? false
  );
  /** what the weekend was spent on, one thing per weekend day */
  const [workedWeekend, setWorkedWeekend] = useState(
    boot?.workedWeekend ?? false
  );
  const [hobbyDone, setHobbyDone] = useState(boot?.hobbyDone ?? false);
  /** an offer waiting on the player, drawn as a two-way prompt */
  const [offer, setOffer] = useState<null | "overtime" | "coffee" | "dinner">(
    null
  );
  /** the ninth evening is offered once, whether or not it is taken */
  const [dinnerAsked, setDinnerAsked] = useState(boot?.dinnerAsked ?? false);
  const [watching, setWatching] = useState(false);
  /*
   * The first morning is a morning like the others: a night got you to three
   * of four. Starting at the top handed day one a fourth build for nothing,
   * and the one day that should teach the player what the coffee is for was
   * the only day they did not need it.
   */
  const [condition, setCondition] = useState(
    boot?.condition ?? SLEEP_RECOVERY
  );
  /** points owed to tonight, from overtime or a weekend shift */
  const [borrowed, setBorrowed] = useState(boot?.borrowed ?? 0);
  /**
   * What one long stint takes out of the night, halved by a decent chair.
   *
   * The chair used to cancel the price of overtime outright, and overtime is
   * the reward for an advert — so in any build where the adverts are not there
   * to be watched, nothing ever borrowed, and a hundred and sixty won bought
   * an item that could not do anything. Half of any long stint is something it
   * can always be doing.
   */
  /**
   * What one long stint takes out of the night.
   *
   * Spirits belong here rather than anywhere else in the day. Someone who has
   * been eating and going home takes a late night better than someone who has
   * not, and that is the only place the difference shows in a working life —
   * not in how fast you read a screen, but in what the next morning costs.
   *
   * Never free. A night worked is a night worked, and a cost that reaches
   * nothing turns the stall from something you want into something you farm.
   */
  const borrowCost = () =>
    Math.max(
      1,
      BORROW_COST -
        (owned.includes("chair") ? 1 : 0) -
        (spirit >= MAX_SPIRIT - 1 ? 1 : 0) +
        (spirit <= 1 ? 1 : 0)
    );
  /** a weekend spent on something else, cashed in on the next morning */
  const [earlyTomorrow, setEarlyTomorrow] = useState(
    boot?.earlyTomorrow ?? false
  );
  /** one restful thing per evening */
  const [restedTonight, setRestedTonight] = useState(
    boot?.restedTonight ?? false
  );
  /** nights eaten at the stall this run, which is what its owner knows of you */
  const [pochaNights, setPochaNights] = useState(boot?.pochaNights ?? 0);
  /** pay, earned by handing defects over, spent on equipment */
  const [pay, setPay] = useState(boot?.pay ?? 0);
  const [owned, setOwned] = useState<ItemId[]>(boot?.owned ?? []);
  const [shop, setShop] = useState<null | "office" | "home">(null);
  /** where the player was standing on the office floor, across a build */
  const [officeAt, setOfficeAt] = useState<{ x: number; y: number } | null>(
    boot?.officeAt ?? null
  );

  /*
   * The run, written down whenever it changes and no build is open.
   *
   * A list of places to call save from is a list somebody has to remember to
   * add to, and the day it is not added to is the day a field quietly stops
   * being saved. So there is no list: the run is built as one string, and the
   * string changing is what a change is. React compares it by value, so a
   * re-render that alters nothing writes nothing.
   *
   * Two moments are excepted. A build in progress is not a state worth
   * restoring into — the player would come back to a half-played build with a
   * clock that had moved on — so nothing is written while one is open, and
   * what that costs is the build, not the day: its bugId is already in the
   * assignment, so reopening the machine finds the same defect waiting. And a
   * run that has shipped is not a run to come back to at all, so the twelfth
   * evening throws the snapshot away instead, and the next opening is a new
   * one.
   */
  const wire = JSON.stringify({
    day,
    assignments,
    pending,
    delivered,
    late,
    shipped_,
    caught,
    missed,
    // the clock ticks in fifths of a minute and is only ever shown to the
    // minute; a fraction here is a fraction the server refuses
    minutes: Math.round(minutes),
    condition,
    spirit,
    borrowed,
    pay,
    owned,
    place,
    from,
    officeAt,
    dayOver,
    hadCoffee,
    greeted,
    talks,
    lastResult,
    overtime,
    tookOvertime,
    tookFreeCoffee,
    workedWeekend,
    hobbyDone,
    ateOut,
    devCoffee,
    devCame,
    retestUsed,
    restedTonight,
    earlyTomorrow,
    pochaNights,
    dinnerAsked,
    codexAtStart,
    runId,
    yearAtStart,
    gift,
    masteredAtStart,
  } satisfies RunFields);

  useEffect(() => {
    const srv = connected ? server : null;
    if (shipped) {
      clearRun(srv);
      return;
    }
    if (running) return;
    saveRun(JSON.parse(wire) as RunFields, srv);
  }, [wire, running, shipped, connected, server]);

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
    // in from the block, or out of bed
    const inside = from === "lane";
    const at = withPlayerAt(homeScene, inside ? 272 : 132, inside ? 545 : 258);
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
  }, [from, day, pace]);
  /**
   * The block, entered from your own doorstep or from the corner of the main
   * road, and the office street, entered from that same corner or out of the
   * office door.
   */
  const laneHere = useMemo(
    () =>
      withSpeed(
        // in off the main road, at the gap; or out of your own front door,
        // with the house behind you
        from === "street"
          ? withPlayerAt(laneScene, 300, 176)
          : withPlayerAt(laneScene, 180, 424),
        pace
      ),
    [from, pace]
  );
  const streetHere = useMemo(
    () => withSpeed(withPlayerAt(streetScene, 180, from === "office" ? 250 : 512), pace),
    [from, pace]
  );

  /*
   * One morning line, wherever the morning came from.
   *
   * Waking up worked out the weekend and the freeze; opening the game did
   * not, so the first screen of a Saturday told the player to get to work.
   * Two places deciding what today is will always end up disagreeing about it.
   */
  /*
   * Whether this is anyone's first run.
   *
   * The defect book is the only thing that outlives a run, so an empty one is
   * a player who has never finished a day — which is exactly who the long
   * version of the first morning is for. It reads the stored book rather than
   * codexRows(), which answers with all hundred and fifteen faults whether
   * they have been met or not and so can never be empty.
   *
   * Read once at mount: it must not change to "returning" underneath a player
   * halfway through the run that is making it true.
   */
  const [firstEverRun] = useState(() => Object.keys(loadCodex()).length === 0);

  /** the first morning of a later year, and the build it brought if any */
  const yearMorning = () => {
    const fresh = LATER_BUILDS.find((b) => b.year === yearAtStart);
    const scene = fresh ? SCENE_BY_ID[fresh.id] : undefined;
    const lines = [tp("home.morningYear", { n: String(yearAtStart) })];
    if (scene) lines.push(tp("home.newBuild", { name: t(scene.nameKey) }));
    // nothing new arrives from the fourth year; what is left is the book
    if (yearAtStart >= 4) {
      lines.push(
        tp("mastery.morning", {
          k: String(mastered.length),
          m: String(buildIdsFor(yearAtStart).length),
        })
      );
    }
    return lines.join("\n");
  };
  const morningFor = (d: number) =>
    isWeekend(d)
      ? t("home.morningWeekend")
      : isFreeze(d)
        ? tp("home.morningFreeze", { n: String(d) })
        : isHotfix(d)
          ? t("event.hotfix.morning")
          : d === 1
          ? yearAtStart >= 2
            ? yearMorning()
            : t(firstEverRun ? "home.morningFirst" : "home.morningFirstAgain")
          : tp(
              // the same day, in the voice of whoever is having it
              spirit >= MAX_SPIRIT - 1
                ? "home.morningBright"
                : spirit <= 1
                  ? "home.morningFlat"
                  : "home.morning",
              { n: String(d) }
            );
  const morningLine = () => morningFor(day);
  // said once on the first morning too, not only on the ones you wake up to —
  // after the gift, when there is one, so the two never open over each other
  useEffect(() => {
    if (giftOwed) return;
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
    if (!runningFree) setCondition((c) => Math.max(0, c - INSPECT_COST));
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
    /*
     * The day explains itself the first time it costs anything.
     *
     * What the pips mean, that sleep refills them, and what the coffee on
     * the walk in is for are all written down already — on the condition
     * meter, behind a tap whose only advertisement is a dotted underline,
     * which on a phone is no advertisement at all. So the sentence comes
     * here instead, at the moment the player has just watched three become
     * two and has a reason to want it explained.
     *
     * Counted in builds signed off rather than in condition: a player who
     * bought a coffee on the way in starts the day at four, so a test
     * against the starting value would skip the first build and fire on the
     * second. caught and missed are still pre-increment here, so this is
     * exactly the first one.
     *
     * After the retest branch, which is the other thing in here that can set
     * a note. On day one there is no money for the retest item, so the two
     * never actually meet — but ordering says so without relying on the
     * economy.
     */
    if (day === 1 && caught + missed === 0) {
      setNote(t("office.firstBuildDone"));
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
    go("street", "office");
    /*
     * And on the ninth, the question that is asked on the pavement rather than
     * at the desk: the day is already signed off, so saying yes costs an
     * evening rather than an hour of the clock.
     */
    if (isDinner(day) && !dinnerAsked) {
      setDinnerAsked(true);
      setOffer("dinner");
    }
  };

  /**
   * The one evening the company pays for.
   *
   * Two of spirits, which is more than the stall gives and more than a
   * weekend's hobby, against a night that ends late — the same borrowed night
   * overtime buys, which caps how rested tomorrow can start. And you have
   * eaten, so the stall has nothing to sell you on the way home.
   */
  const goToDinner = () => {
    setOffer(null);
    setSpirit((v) => Math.min(MAX_SPIRIT, v + DINNER_SPIRIT));
    setBorrowed((b) => b + 1);
    setAteOut(true);
    sfx.play("pick");
    setNote(t("event.dinner.went"));
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
    setAssignments(isWeekend(next) ? [] : assignDay(next, builds, MACHINES));
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
    setCondition((c) => {
      const rested = Math.max(
        0,
        Math.min(MAX_CONDITION - borrowed, c + SLEEP_RECOVERY)
      );
      // the morning something that already shipped came back: the message
      // arrived at three, and the day starts with what that was worth
      return isHotfix(next) ? Math.max(0, rested - HOTFIX_CONDITION) : rested;
    });
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
    // everyone on the walk starts the day with their first line again, which
    // is what makes the freeze and the morning-after ones land
    setGreeted({});
    setAteOut(false);
    setOvertime(0);
    setTookOvertime(false);
    setTookFreeCoffee(false);
    setDayOver(false);
    go("home", "wake");
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
     * It is still worth nothing without a machine that can be opened — one with
     * condition left for it, or a mastered one that needs none — so that one
     * state does not raise it.
     */
    if (assignments.some(canOpen) && !tookOvertime) {
      setOffer("overtime");
      return;
    }
    clockOff();
  };
  goHomeRef.current = endOfDay;

  /** the coffee as it has always been bought: with an hour of the day */
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

  /**
   * The half hour, or the cup, given for nothing.
   *
   * The same grant whether it was paid for with thirty seconds of advert or
   * bought outright — one place, so the two routes cannot drift into being
   * two different rewards. Neither touches the daily limit: the flags below
   * are what stop a second one, and owning the shop item does not clear them.
   */
  const grantFree = (kind: "overtime" | "coffee") => {
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

  /** the reward, once the ad has actually run to the end */
  const takeOffer = async (kind: "overtime" | "coffee") => {
    /*
     * Bought out of the wait. The grant below is the same one the advert
     * leads to — this skips the thirty seconds, not the conditions.
     */
    if (adsRemoved) {
      setOffer(null);
      grantFree(kind);
      return;
    }
    setWatching(true);
    const out = await showRewarded(kind);
    setWatching(false);
    setOffer(null);
    if (out.kind !== "granted") {
      /*
       * Nothing was earned and nothing was decided. It used to send the player
       * home, from a prompt whose whole point is that going home is one of
       * three answers — so the prompt comes back instead.
       *
       * Unless there are no adverts in this session at all, in which case the
       * prompt comes back without its third line and the player is choosing
       * between the two that were always there. Saying why would mean
       * explaining an ad network to someone at their desk at six o'clock.
       */
      setOffer(kind);
      if (out.kind === "none" && out.failed) setNote(t("offer.adFailed"));
      return;
    }
    grantFree(kind);
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

  /** what they have to say, out of the state of the day */
  const devSays = () =>
    devLine({
      day,
      days: DAYS,
      firstTalk: day === 1 && talks === 0,
      pending: pending.length,
      lastResult,
      left,
      freeze: isFreeze(day),
      weekend: isWeekend(day),
      hotfix: isHotfix(day),
      spirit,
      talks,
      level: devLevel,
    });

  const buy = (item: ItemId, cost: number) => {
    if (owned.includes(item) || pay < cost) return;
    setPay((p) => p - cost);
    setOwned((o) => [...o, item]);
    sfx.play("success");
  };

  /** the year's gift: bought for nothing, once, and then the morning */
  const takeGift = (item: GiftId) => {
    if (gift !== null) return;
    setGift(item);
    setOwned((o) => (o.includes(item) ? o : [...o, item]));
    sfx.play("success");
    setNote(morningLine());
  };

  /**
   * Whoever this is, in their own words, at the right end of the day.
   *
   * The first time you speak to somebody on a day that is about something —
   * the freeze, or a morning after a night you borrowed — they say the thing
   * that day is about. After that they are back in their own rotation, which
   * is how a person on a pavement works: they mention it once.
   */
  const greet = (id: string) => {
    const person = PASSERS[id];
    if (!person) return;
    const said = greeted[id] ?? 0;
    setNote(
      t(
        passerLine(person, said, {
          dayOver,
          freeze: isFreeze(day),
          // a night spent at the office shows on the walk in: the day starts
          // with the points a night off would have given back
          worn: condition <= MAX_CONDITION - 2,
        })
      )
    );
    setGreeted((g) => ({ ...g, [id]: said + 1 }));
  };

  const onStreetStation = (id: string) => {
    if (id === "officeDoor") {
      if (dayOver) return setNote(t("street.shut"));
      if (isWeekend(day) && !workedWeekend) return setNote(t("street.weekend"));
      sfx.play("click");
      /*
       * Walking in the front door starts you at the front door.
       *
       * officeAt remembers where the player was standing so that opening a
       * build and stepping back out of it does not cost them the walk to the
       * machine again. It was being kept across the whole commute as well, so
       * arriving at work put them wherever they had been when they left the
       * night before — usually at a machine, which reads as the game having
       * skipped the morning. Reported as "sometimes I start at the computer
       * instead of the entrance".
       */
      setOfficeAt(null);
      setPlace("office");
      setNote(null);
      return;
    }
    if (id.startsWith("passer")) return greet(id);
    if (id.startsWith("toLane")) {
      sfx.play("click");
      setNote(null);
      go("lane", "street");
      return;
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

  /**
   * The block the flat is on: your own front door, the stall, and the corner
   * that takes you out to the office street.
   */
  const onLaneStation = (id: string) => {
    if (id === "frontDoor") {
      sfx.play("click");
      setNote(null);
      go("home", "lane");
      return;
    }
    if (id === "toStreet") {
      sfx.play("click");
      setNote(null);
      go("street", "lane");
      return;
    }
    if (id.startsWith("passer")) return greet(id);
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
      setPochaNights((n) => n + 1);
      sfx.play("pick");
      /*
       * What they say, and then what it cost. The other way round reads as a
       * receipt with a comment stapled to it, and the numbers are the part the
       * player can already see in the bar.
       */
      return setNote(
        `${t(
          pochaLine({
            nights: pochaNights,
            spirit,
            max: MAX_SPIRIT,
            freeze: isFreeze(day),
            lastDay: day >= DAYS,
          })
        )}
${tp("street.pochaAte", { n: String(POCHA_PAY) })}`
      );
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
          assignDay(day, builds, [MACHINES[0]]).map((a) => ({ ...a, hotfix: true }))
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
      go("lane", "home");
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
      setNote(t(devSays()));
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
    const free = mastered.includes(a.sceneId);
    if (!free && condition < INSPECT_COST) return setNote(t("office.tooTired"));
    setRunningFree(free);
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
      (sum, d) => sum + totalStake(1, assignDay(d, builds, MACHINES).map((a) => a.severity)),
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
      /*
       * Twelve days end here, and until now they ended in silence: sleep()
       * returns before its own click on the last night, and this screen
       * played nothing. It is the one moment in the run that is only a
       * result, so it gets a sound — and a different one either way, because
       * the same noise for a build that shipped clean and one that shipped
       * broken is a page turning, not an answer.
       *
       * It lives here rather than in sleep() because this is where the
       * rating exists. Computing it early would mean copying the stake sum
       * out of the render, and two copies of that can disagree.
       */
      sfx.play(rating >= 3 ? "success" : "fail");
      /*
       * The run is a year now. Written to the device first, so a tab closed on
       * this screen still counts it. The account hears after the rating has
       * landed: syncYears turns an old runs count into legacy ids once, and it
       * has to see this run already counted there to subtract it.
       */
      addYear(runId);
      bestBefore.current = recordBest(rating);
      void (async () => {
        const srv = connected ? server : null;
        await reportRun(srv, rating);
        if (srv) await syncYears(srv);
      })();
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
        {(() => {
          /*
           * Against the runs before it. Compared at the tenth the screen
           * shows, so a record is never announced over two equal numbers.
           * A first run has nothing to beat and says nothing.
           */
          const prev = bestBefore.current;
          if (prev === null) return null;
          const tenth = (v: number) => Math.round(v * 10);
          return tenth(rating) > tenth(prev) ? (
            <p className="wb-best wb-best-new">
              {tp("ship.bestNew", { prev: prev.toFixed(1) })}
            </p>
          ) : (
            <p className="wb-best">
              {tp("ship.best", { best: Math.max(prev, rating).toFixed(1) })}
            </p>
          );
        })()}
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
        {/*
          And the one person who saw both numbers. The screen was two figures
          and a book count with nobody in it — the developer worked the same
          fortnight, and what they say about it depends on how much of their
          own work reached them.
        */}
        <p className="wb-dev-word">{t(devShipLine(rating, devLevel))}</p>
        {(() => {
          const book = codexTally(codexRows(undefined, yearAtStart));
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
        {(() => {
          /*
           * What this run added to the builds that cost nothing. Read from the
           * book as it stands against the list taken when the run began.
           */
          const now = masteredBuilds(codexRows(undefined, yearAtStart));
          const fresh = now.filter((id) => !masteredAtStart.includes(id));
          const every = now.length === buildIdsFor(Number.MAX_SAFE_INTEGER).length;
          if (!fresh.length && !every) return null;
          return (
            <p className="wb-tally wb-mastery">
              {fresh.length > 0 &&
                tp("mastery.fresh", {
                  names: fresh.map((id) => t(`stage.${id}.name`)).join(", "),
                })}
              {fresh.length > 0 && every && <br />}
              {every && t("mastery.all")}
            </p>
          );
        })()}
        {(() => {
          /*
           * What the next run will be. Read from the device's set, which this
           * run was added to above — and which another device may have pushed
           * further on, in which case this says so.
           */
          const nextYear = yearOf(loadYears());
          const arriving = LATER_BUILDS.filter(
            (b) => b.year > yearAtStart && b.year <= nextYear
          )
            .map((b) => SCENE_BY_ID[b.id])
            // a type guard, not filter(Boolean): TypeScript does not narrow
            // through Boolean, and arriving[0].nameKey would not compile
            .filter((sc): sc is SceneSpec => sc !== undefined);
          const line = arriving.length
            ? tp("ship.nextYearBuild", {
                n: String(nextYear),
                name: t(arriving[0].nameKey),
              })
            : tp("ship.nextYear", { n: String(nextYear) });
          return (
            <p className="wb-tally wb-year">
              {line}
              {yearAtStart < 2 && nextYear >= 2 && (
                <>
                  <br />
                  {t("ship.giftAhead")}
                </>
              )}
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
    const prefer = preferFor(bookRows, running.sceneId);
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
          tutorial={day === 1}
          bugId={build.bugId}
          prefer={prefer}
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
        tutorial={day === 1}
        bugId={build.bugId}
        prefer={prefer}
        onBugPicked={build.onBugPicked}
        onClear={build.onClear}
        onFail={build.onFail}
        onExit={build.onExit}
      />
    );
  }

  const left = assignments.filter((a) => a.result === null).length;

  /*
   * The one thing to do next, and where it is.
   *
   * Three rooms, four machines, a developer, two shops, a sofa, a bed and a
   * stall, and nothing anywhere said which of them the day was waiting on. A
   * player who put the game down on Tuesday came back to a flat with no idea
   * why they were in it.
   *
   * One line, derived rather than scripted, so it cannot drift out of step
   * with the state it describes. Order matters: look at builds while there is
   * anything to look with, hand over when there is not, and go home when",
   * there is neither — which is the loop the office was built around.
   */
  const quest = (): {
    key: string;
    params?: Record<string, string>;
    at?: string;
  } => {
    if (place === "home") {
      if (dayOver) return { key: "quest.sleep", at: "bed" };
      if (isWeekend(day) && !workedWeekend) {
        return { key: "quest.weekend", at: "hobby" };
      }
      return { key: "quest.goWork", at: "frontDoor" };
    }
    if (place === "lane") {
      // the corner in the morning, your own door at the end of it
      if (dayOver) return { key: "quest.goHome", at: "frontDoor" };
      return { key: "quest.goStreet", at: "toStreet" };
    }
    if (place === "street") {
      if (dayOver) return { key: "quest.goHome", at: "toLane" };
      /*
       * The machine on the way in, while it is still on the way in.
       *
       * Four builds and three points to look at them with: the fourth is a
       * coffee, and the only place to buy one is a machine the player walks
       * straight past on their way to the door. Being told about it once in the
       * first morning is not the same as being told about it on the morning it
       * is needed.
       */
      const costly = assignments.filter(
        (a) => a.result === null && !mastered.includes(a.sceneId)
      ).length;
      if (!hadCoffee && condition < costly) {
        return { key: "quest.coffee", at: "coffee" };
      }
      return { key: "quest.goOffice", at: "officeDoor" };
    }
    if (assignments.some(canOpen)) {
      // the worst one first, which is the advice the pips are already giving
      const worst = assignments
        .filter((a) => canOpen(a))
        .reduce((best, a) =>
          SEVERITY_PIPS[a.severity] > SEVERITY_PIPS[best.severity] ? a : best
        );
      return {
        key: "quest.runBuild",
        params: { machine: t(`object.${worst.machine}`) },
        at: worst.machine,
      };
    }
    if (pending.length) {
      return {
        key: "quest.handOver",
        params: { n: String(pending.length) },
        at: "dev",
      };
    }
    if (left) return { key: "quest.outOfEyes", at: "exitDoor" };
    return { key: "quest.clockOff", at: "exitDoor" };
  };

  /** evaluated once: the line reads it, and so does the mark in the world */
  const here = quest();
  const sky = skyAt(minutes);

  /**
   * The bar the two outdoor screens share. They are one walk with a corner in
   * the middle of it, and a clock that reads differently on either side of
   * that corner would be two different afternoons.
   */
  const outdoorHeader = (
    <div className="wb-header">
      <span className="wb-build">
        {tp("office.day", { n: String(day) })} {t(dayName(day))}
      </span>
      <span className="office-clock">{clock(minutes)}</span>
      <span className="office-condition">
        {t("home.condition")} {"●".repeat(condition)}
        {"○".repeat(MAX_CONDITION - condition)}
      </span>
      {/* the other half of what the twelve days are making */}
      <button
        type="button"
        className="office-spirit hud-ask"
        onClick={() => setNote(t("spirit.what"))}
      >
        {"♥".repeat(spirit)}
        {"♡".repeat(MAX_SPIRIT - spirit)}
      </button>
    </div>
  );

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
      {place === "lane" ? (
        <EngineStage
          key={`lane-${day}`}
          scene={laneHere}
          markId={here.at ?? null}
          mode="play"
          header={outdoorHeader}
          onStation={onLaneStation}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : place === "street" ? (
        <EngineStage
          key={`street-${day}`}
          scene={streetHere}
          markId={here.at ?? null}
          mode="play"
          header={outdoorHeader}
          onStation={onStreetStation}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : place === "home" ? (
        <EngineStage
          key={`home-${day}`}
          scene={homeHere}
          markId={here.at ?? null}
          mode="play"
          header={
            <div className="wb-header">
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
              <button
                type="button"
                className="office-spirit hud-ask"
                onClick={() => setNote(t("spirit.what"))}
              >
                {"♥".repeat(spirit)}
                {"♡".repeat(MAX_SPIRIT - spirit)}
              </button>
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
        markId={here.at ?? null}
        mode="play"
        onPlayerRest={setOfficeAt}
        header={
          <div className="wb-header">
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
            {/* six o'clock is decided in this room, and what it costs is here */}
            <button
              type="button"
              className="office-spirit hud-ask"
              onClick={() => setNote(t("spirit.what"))}
            >
              {"♥".repeat(spirit)}
              {"♡".repeat(MAX_SPIRIT - spirit)}
            </button>
            <span className="office-pay">{tp("office.pay", { n: String(pay) })}</span>
            <span className="office-queue">
              {assignments.map((a) => (
                <b
                  key={a.machine}
                  className={`q-${a.severity} ${a.result ? "done" : ""} ${mastered.includes(a.sceneId) ? "mastered" : ""} hud-ask`}
                  title={`${t(`object.${a.machine}`)} · ${t(`office.sev.${a.severity}`)}`}
                  onClick={() =>
                    setNote(
                      tp(a.result ? "office.whatChipDone" : "office.whatChip", {
                        machine: t(`object.${a.machine}`),
                        sev: t(`office.sev.${a.severity}`),
                      }) + (mastered.includes(a.sceneId) ? `\n${t("mastery.chip")}` : "")
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
      {/* what the day is waiting on, over the top of the room it is in */}
      {!running && !shipped && (
        <div className="quest">
          {here.params ? tp(here.key, here.params) : t(here.key)}
        </div>
      )}

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
                className="btn-ghost"
                disabled={watching}
                onClick={() => {
                  const kind = offer;
                  setOffer(null);
                  // saying no at six o'clock is knocking off; at the machine it
                  // is walking past it; on the ninth it is going home instead
                  if (kind === "overtime") clockOff();
                  if (kind === "dinner") setNote(t("event.dinner.skipped"));
                }}
              >
                {t(`offer.${offer}.no`)}
              </button>
              <button
                className="btn-primary"
                disabled={watching}
                onClick={() => {
                  if (offer === "overtime") return stayLate();
                  if (offer === "dinner") return goToDinner();
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
            {/* the advert buys the half hour or the cup; nobody sells you a
                dinner the company is already paying for */}
            {(adsRemoved || adsAvailable()) &&
              (offer === "overtime" || (offer === "coffee" && !tookFreeCoffee)) && (
                <button
                  className="offer-free"
                  disabled={watching}
                  onClick={() => takeOffer(offer)}
                >
                  {/* bought, so there is no advert to sit through and no
                      reason to say there is — the same line without the wait */}
                  {watching
                    ? t("offer.watching")
                    : t(`offer.${offer}.${adsRemoved ? "owned" : "free"}`)}
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
              const rows = codexRows(undefined, yearAtStart);
              const tally = codexTally(rows);
              const done = masteredBuilds(rows);
              const buildCount = buildProgress(rows).size;
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
                  <p className="codex-tally">
                    {tp("mastery.tally", { k: String(done.length), m: String(buildCount) })}
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
                          {done.includes(sceneId) && (
                            <em className="codex-mastered">{t("mastery.stamp")}</em>
                          )}
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

      {/*
        The year's gift. The shop's own markup, so it reads as the same
        catalogue, with no close button and a backdrop that does nothing: the
        only way out is to take something, because closing it by accident would
        throw the gift away.
      */}
      {giftOwed && (
        <div className="modal-backdrop">
          <div className="modal shop" onClick={(e) => e.stopPropagation()}>
            <h2>{tp("gift.title", { n: String(yearAtStart) })}</h2>
            <div className="shop-list">
              {GIFTS.map((id) => (
                <button key={id} className="shop-item" onClick={() => takeGift(id)}>
                  <span className="shop-name">{t(`item.${id}`)}</span>
                  <span className="shop-desc">{t(`item.${id}.desc`)}</span>
                  <em>{t("gift.take")}</em>
                </button>
              ))}
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
