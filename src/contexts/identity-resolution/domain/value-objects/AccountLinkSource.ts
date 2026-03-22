export const accountLinkSourceValues = [
  'MANUAL_CONFIRMED',
  'USER_ASSERTED',
  'SUGGESTED',
  'IMPORTED',
] as const;

export type AccountLinkSource = (typeof accountLinkSourceValues)[number];
