/**
 * Client-facing registration helpers.
 * Features import from here (hooks layer), not from `@/services/registration/*`.
 */
export {
  answerProgressCounts,
  fieldMeta,
  isAnswered,
  showsAedExemptionQuestion,
} from "@/services/registration/answerMeta";
export type {
  DecisionProtocolEntry,
  FieldAnswerMeta,
} from "@/services/registration/answerMeta";
export type { CheckRuleHit } from "@/services/registration/checkRules";
export {
  MESSGROESSEN,
  messgroesseByKey,
  messgroesseNeedsVariante,
  zifferAus,
} from "@/services/registration/messgroessen";
