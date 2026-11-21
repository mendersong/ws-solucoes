import type { Deadline } from "./finance";

export function deadlineLabel(deadline: Deadline): string {
  return deadline.label;
}

export function serviceTypeLabel(type: string): string {
  return type;
}
