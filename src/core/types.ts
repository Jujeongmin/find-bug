export type BugCategory =
  | "no-action" // 동작 안 함
  | "weird-movement" // 이상한 움직임
  | "graphic" // 그래픽 오류
  | "physics" // 물리 오류
  | "logic"; // 논리 오류

export const ALL_CATEGORIES: BugCategory[] = [
  "no-action",
  "weird-movement",
  "graphic",
  "physics",
  "logic",
];

export interface BugDef {
  id: string;
  /** objects accepted as a correct pick — any one of them wins */
  objectIds: string[];
  category: BugCategory;
  /**
   * Categories that describe the same observation just as well.
   *
   * Walking into something that should hurt and feeling nothing is a thing
   * that did not react, and it is also a body passing through another body.
   * Both readings are honest, and a tester who files the second one has not
   * made a mistake — so the report takes either.
   */
  alsoCategories?: BugCategory[];
  /** i18n key for the post-clear explanation */
  descKey: string;
}

export interface StageDef {
  id: string;
  nameKey: string;
  bugPool: BugDef[];
}

export interface Verdict {
  correct: boolean;
  objectCorrect: boolean;
  categoryCorrect: boolean;
}
