import { AlertIcon, BugIcon } from "../../components/icons";
import { useEffect, useRef, useState } from "react";
import type { BugCategory, BugDef } from "../../core/types";
import { judge, pickBug } from "../../core/judge";
import { stage04 } from "./bugs";
import { useI18n } from "../../i18n";
import { CategorySelect } from "../../components/CategorySelect";
import { ResultModal } from "../../components/ResultModal";
import { FieldScaler, FIELD_W, FIELD_H } from "../../components/FieldScaler";
import { PlaytestBar } from "../../components/PlaytestBar";
import { spriteStyle } from "../../engine/spriteStyle";
import { sfx } from "../../audio/sfx";
import face0 from "../../assets/cards/card_hearts_A.png";
import face1 from "../../assets/cards/card_spades_02.png";
import face2 from "../../assets/cards/card_diamonds_03.png";
import face3 from "../../assets/cards/card_clubs_04.png";
import face4 from "../../assets/cards/card_hearts_05.png";
import face5 from "../../assets/cards/card_spades_06.png";
import face6 from "../../assets/cards/card_diamonds_07.png";
import face7 from "../../assets/cards/card_clubs_08.png";
import "../../styles/shared.css";
import { HAS_KEYBOARD } from "../../components/useSpaceCloses";
import "./stage04.css";

type Phase = "intro" | "play" | "picking" | "category" | "result";

/** face id -> bundled url, so the path survives whatever base we deploy under */
const FACE_URLS: Record<string, string> = {
  card_hearts_A: face0,
  card_spades_02: face1,
  card_diamonds_03: face2,
  card_clubs_04: face3,
  card_hearts_05: face4,
  card_spades_06: face5,
  card_diamonds_07: face6,
  card_clubs_08: face7,
};
const CARD_FACES = Object.keys(FACE_URLS);
const cardUrl = (name: string) => FACE_URLS[name];
const GRID = 4;
const CARD_W = 76;
const CARD_H = 76;
const GAP = 8;
const GRID_X = 22;
const GRID_Y = 190;

interface Card {
  key: number; // stable identity for React
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

interface Deal {
  cards: Card[];
  /** card index affected by E1 (unclickable) / E2 (vertical flip) */
  bugCardIdx: number;
  /** pair emoji affected by E3 (color mismatch) / E8 (never matches) */
  bugPairEmoji: string;
}

function makeDeal(): Deal {
  const emojis = [...CARD_FACES, ...CARD_FACES];
  for (let i = emojis.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
  }
  return {
    cards: emojis.map((emoji, i) => ({
      key: i,
      emoji,
      flipped: false,
      matched: false,
    })),
    bugCardIdx: Math.floor(Math.random() * 16),
    bugPairEmoji: CARD_FACES[Math.floor(Math.random() * CARD_FACES.length)],
  };
}

interface Props {
  onClear: () => void;
  onExit: () => void;
  playtest?: boolean;
  stageNo?: number;
  title?: string;
  /** the defect this build already has, if it has been opened before */
  bugId?: string | null;
  onBugPicked?: (bugId: string) => void;
  /** what a wrong report means; without it the player gets another go */
  onFail?: () => void;
}

export function Stage04({
  onClear,
  onExit,
  playtest = false,
  stageNo,
  title,
  bugId,
  onBugPicked,
  onFail,
}: Props) {
  const { t } = useI18n();
  // a build already opened does not read you its briefing again
  const [phase, setPhase] = useState<Phase>(bugId ? "play" : "intro");
  const [bug, setBug] = useState<BugDef>(
    () => stage04.bugPool.find((b) => b.id === bugId) ?? pickBug(stage04.bugPool)
  );
  // tell the caller which defect it got, so the same one is waiting on the
  // machine when the player comes back to it
  useEffect(() => {
    if (!bugId) onBugPicked?.(bug.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pickedObject, setPickedObject] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(false);

  const [deal, setDeal] = useState<Deal>(makeDeal);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [lock, setLock] = useState(false);
  const [realAttempts, setRealAttempts] = useState(0);
  const [pairs, setPairs] = useState(0);
  const [shuffling, setShuffling] = useState(false);

  const bugRef = useRef<BugDef>(bug);
  bugRef.current = bug;

  /** the planted defect, not the prop that asked for it */
  const planted = bug.id;
  const picking = phase === "picking";

  // E4: the tries counter only counts every other try
  const shownAttempts = planted === "E4" ? Math.floor(realAttempts / 2) : realAttempts;

  const onCardClick = (idx: number) => {
    if (phase !== "play" || lock || shuffling) return;
    const c = deal.cards[idx];
    if (c.flipped || c.matched) return;
    // E1: one designated card refuses to flip
    if (planted === "E1" && idx === deal.bugCardIdx) return;
    sfx.play("click");

    const next = deal.cards.map((card, i) =>
      i === idx ? { ...card, flipped: true } : card
    );
    setDeal({ ...deal, cards: next });

    if (firstPick === null) {
      setFirstPick(idx);
      return;
    }

    const a = next[firstPick];
    const b = next[idx];
    setLock(true);
    setRealAttempts((n) => n + 1);
    const firstIdx = firstPick;
    setFirstPick(null);

    // E8: the designated pair never passes the match check
    const isMatch =
      a.emoji === b.emoji && !(planted === "E8" && a.emoji === deal.bugPairEmoji);

    setTimeout(() => {
      setDeal((d) => {
        const cards = d.cards.map((card, i) => {
          if (i !== firstIdx && i !== idx) return card;
          return isMatch
            ? { ...card, matched: true }
            : { ...card, flipped: false };
        });
        return { ...d, cards };
      });
      if (isMatch) {
        setPairs((p) => {
          const np = p + 1;
          if (np >= 8) {
            // all cleared — deal again after a beat
            setTimeout(() => {
              setDeal(makeDeal());
              setPairs(0);
            }, 1500);
          }
          return np;
        });
      }
      setLock(false);
    }, 800);
  };

  const onShuffle = () => {
    if (phase !== "play" || lock || shuffling) return;
    setShuffling(true);
    setTimeout(() => setShuffling(false), 600);
    // E5: the shuffle motion plays but the cards never actually move
    if (planted === "E5") return;
    setDeal((d) => {
      const idxs = d.cards.map((_, i) => i).filter((i) => !d.cards[i].matched);
      const shuffledIdxs = [...idxs];
      for (let i = shuffledIdxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIdxs[i], shuffledIdxs[j]] = [shuffledIdxs[j], shuffledIdxs[i]];
      }
      const cards = [...d.cards];
      idxs.forEach((from, k) => {
        cards[shuffledIdxs[k]] = {
          ...d.cards[from],
          flipped: false,
        };
      });
      // keep the bug card index pointing at a random unmatched card
      return { ...d, cards, bugCardIdx: Math.floor(Math.random() * 16) };
    });
    setFirstPick(null);
  };

  const onPickObject = (objectId: string) => {
    sfx.play("pick");
    setPickedObject(objectId);
    setPhase("category");
  };

  const onSubmitCategory = (category: BugCategory) => {
    const correct = judge(bug, pickedObject!, category).correct;
    sfx.play(correct ? "success" : "fail");
    setResultSuccess(correct);
    setPhase("result");
  };

  const onRetry = () => {
    setBug(pickBug(stage04.bugPool, bug.id));
    setDeal(makeDeal());
    setFirstPick(null);
    setLock(false);
    setRealAttempts(0);
    setPairs(0);
    setPickedObject(null);
    setPhase("play");
  };

  const pickableProps = (objectId: string, baseClass = "") =>
    picking
      ? {
          className: `${baseClass} pickable`.trim(),
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onPickObject(objectId);
          },
          title: t(`object.${objectId}`),
        }
      : baseClass
        ? { className: baseClass }
        : {};

  // E6: the pot hovers past the table edge; normally it sits on the floor by the table
  const potLift = planted === "E6" ? 34 : 0;

  return (
    <div className="stage-frame">
      <div className="stage-header">
        <span className="stage-name">
          <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
            ←
          </button>
          {stageNo ? stageNo + ". " : ""}
          {title ?? t("stage.stage04.name")}
        </span>
        <div className="challenge-wrap">
          <button
            className="challenge-btn"
            disabled={phase !== "play"}
            onClick={() => setPhase("picking")}
          >
            <AlertIcon size={13} /> {t("challenge.button")}
          </button>
        </div>
      </div>

      {playtest && (
        <PlaytestBar
          info={{
            sceneId: "stage04",
            poolSize: stage04.bugPool.length,
            bugId: bug.id,
            answers: bug.objectIds.map((id) => t(`object.${id}`)).join(" / "),
            category: t(`category.${bug.category}`),
            desc: t(bug.descKey),
          }}
          onReroll={() => {
            setBug(pickBug(stage04.bugPool, bug.id));
            setDeal(makeDeal());
            setFirstPick(null);
            setLock(false);
            setRealAttempts(0);
            setPairs(0);
          }}
        />
      )}

      <FieldScaler>
        <div
          className={`field s4-room ${picking ? "picking" : ""}`}
          style={{ width: FIELD_W, height: FIELD_H }}
        >
          {/* HUD */}
          <div className="hud">
            <div {...pickableProps("attemptCounter", "score-box")}>
              {t("hud.attempts")}: {shownAttempts}
            </div>
            <div {...pickableProps("pairCounter", "score-box")}>
              {t("hud.pairs")}: {pairs}/8
            </div>
          </div>

          {/* wall decorations */}
          <div {...pickableProps("curtain", "s4-curtain")} />
          {/*
            The picture is drawn in the stylesheet rather than taken from a
            sheet. What hung here was roguelike (28,9) — fifty opaque pixels,
            all of them in the bottom half of their tile, which is an object and
            not a picture. Turned upside down it moved to the top half of the
            frame and stayed unreadable, so the one thing the defect claims was
            the one thing the player could not see. A landscape has an up.
          */}
          <div {...pickableProps("frame", "s4-frame")}>
            <span className={`s4-picture ${planted === "E7" ? "upside" : ""}`} />
          </div>
          <div {...pickableProps("lamp", "s4-lamp")}>
            <div className="s4-lamp-glow" />
            <span className="s4-bulb" />
          </div>

          {/* table (behind the cards) */}
          <div {...pickableProps("table", "s4-table")} />

          {/* cards */}
          {deal.cards.map((c, i) => {
            const col = i % GRID;
            const row = Math.floor(i / GRID);
            const vertical = planted === "E2" && i === deal.bugCardIdx;
            return (
              <div
                key={c.key}
                className={`s4-card ${shuffling ? "shuffling" : ""} ${
                  c.matched ? "matched" : ""
                } ${picking ? "pickable" : ""}`}
                style={{
                  left: GRID_X + col * (CARD_W + GAP),
                  top: GRID_Y + row * (CARD_H + GAP),
                }}
                onClick={
                  picking
                    ? (e) => {
                        e.stopPropagation();
                        onPickObject("cards");
                      }
                    : () => onCardClick(i)
                }
                title={picking ? t("object.cards") : undefined}
              >
                <div
                  className={`s4-card-inner ${vertical ? "vflip" : ""} ${
                    c.flipped || c.matched ? "open" : ""
                  }`}
                >
                  <div className="s4-card-back" />
                  <div
                    className="s4-card-face"
                    style={{ backgroundImage: `url(${cardUrl(c.emoji)})` }}
                  />
                </div>
              </div>
            );
          })}

          {/* floor decorations */}
          <div
            className={`s4-pot ${picking ? "pickable" : ""}`}
            style={{ bottom: 26 + potLift }}
            onClick={
              picking
                ? (e) => {
                    e.stopPropagation();
                    onPickObject("pot");
                  }
                : undefined
            }
            title={picking ? t("object.pot") : undefined}
          >
            <span
              style={spriteStyle({ sheet: "roguelike", col: 24, row: 9, scale: 2 })}
            />
          </div>
          <div {...pickableProps("doll", "s4-cat")}>
            <span
              style={spriteStyle({ sheet: "platchars", col: 4, row: 1, scale: 1.5 })}
            />
          </div>

          {/* shuffle button */}
          <button
            onClickCapture={picking ? undefined : onShuffle}
            {...pickableProps("shuffleBtn", "s4-shuffle-btn")}
          >
            {t("cards.shuffle")}
          </button>

          {picking && (
            <div className="picking-banner">
              {t("challenge.pickObject")}
              <button className="btn-ghost small" onClick={() => setPhase("play")}>
                {t("challenge.cancel")}
              </button>
            </div>
          )}
        </div>
      </FieldScaler>

      {phase === "intro" && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>
              <BugIcon size={16} /> {t("intro.stage04.line")}
            </h2>
            <p className="intro-goal">{t("goal.stage04")}</p>
            <p>{t("intro.hint")}</p>
            <p className="once-warning">{t("challenge.once")}</p>
            <div className="modal-actions">
              <button data-space className="btn-primary" onClick={() => setPhase("play")}>
                {t("intro.go")}
                {HAS_KEYBOARD && <em className="key-hint">space</em>}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "category" && pickedObject && (
        <CategorySelect
          targetObjectId={pickedObject}
          onSubmit={onSubmitCategory}
          onCancel={() => setPhase("picking")}
        />
      )}

      {phase === "result" && (
        <ResultModal
          success={resultSuccess}
          bug={resultSuccess ? bug : null}
          onRetry={onFail ?? onRetry}
          onDone={onClear}
        />
      )}
    </div>
  );
}
