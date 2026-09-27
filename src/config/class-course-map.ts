/**
 * Add the LMS course IDs you want to assign automatically for each class.
 *
 * Example:
 * '6': [11, 12, 15]
 * 'VI': [11, 12, 15]
 *
 * normalizeClassGrade() lets "Class 6", "6", "VI" etc. be mapped by aliases below.
 */
export const CLASS_COURSE_MAP: Record<string, number[]> = {
  "1": [123],
  "2": [123],
  "3": [123, 120],
  "4": [123, 120],
  "5": [123, 120],
  "6": [118, 124, 119, 120],
  "7": [118, 124, 119, 122],
  "8": [118, 124, 119, 122],
  "9": [118, 124, 119, 122],
  "10": [118, 124, 119, 122],
  "11": [118, 119, 122],
  "12": [118, 119, 122],
};

const ROMAN_TO_NUMBER: Record<string, string> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
  VI: "6",
  VII: "7",
  VIII: "8",
  IX: "9",
  X: "10",
  XI: "11",
  XII: "12",
};

const NUMBER_TO_ROMAN: Record<string, string> = {
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
  "7": "VII",
  "8": "VIII",
  "9": "IX",
  "10": "X",
  "11": "XI",
  "12": "XII",
};

export function classGradeForDatabase(value: string): string {
  const normalized = normalizeClassGrade(value);

  return NUMBER_TO_ROMAN[normalized] ?? normalized;
}

export function normalizeClassGrade(value: string): string {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/^CLASS\s*/i, "");
  return ROMAN_TO_NUMBER[cleaned] ?? cleaned;
}

export function courseIdsForClass(classGrade: string): number[] {
  return CLASS_COURSE_MAP[normalizeClassGrade(classGrade)] ?? [];
}
