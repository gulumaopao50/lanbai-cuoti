import { addDays, dateKey } from "./date.js";

export const REVIEW_INTERVALS = [1, 3, 7, 15];

export const STATUS_LABELS = {
  todo: "待复习",
  reviewing: "复习中",
  mastered: "已掌握",
};

export const STATUS_CLASS = {
  todo: "badge-gray",
  reviewing: "badge-blue",
  mastered: "badge-ok",
};

export const REASONS = ["概念不清", "计算失误", "审题错误", "时间不足", "其他"];

export const DIFFICULTIES = [
  { value: 1, label: "简单" },
  { value: 2, label: "较易" },
  { value: 3, label: "中等" },
  { value: 4, label: "较难" },
  { value: 5, label: "困难" },
];

export function difficultyLabel(value) {
  const item = DIFFICULTIES.find((d) => d.value === Number(value));
  return item ? item.label : "中等";
}

export function planNextReview(reviewCount, from = new Date()) {
  const index = Math.min(Math.max(0, reviewCount), REVIEW_INTERVALS.length - 1);
  return addDays(dateKey(from), REVIEW_INTERVALS[index]);
}

export function nextReviewState(mistake) {
  const count = (Number(mistake.reviewCount) || 0) + 1;
  const mastered = count >= REVIEW_INTERVALS.length;
  return {
    reviewCount: count,
    status: mastered ? "mastered" : "reviewing",
    lastReviewAt: new Date().toISOString(),
    nextReviewAt: mastered ? null : planNextReview(count),
  };
}

export function isDue(mistake, today = dateKey()) {
  if (!mistake || mistake.status === "mastered") return false;
  if (!mistake.nextReviewAt) return true;
  return mistake.nextReviewAt <= today;
}