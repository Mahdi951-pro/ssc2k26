import { Check, CheckCheck } from "lucide-react";

interface Props {
  /** number of OTHER members (excluding sender) who have read this message */
  readCount: number;
  /** total number of OTHER members in the conversation */
  otherMembers: number;
}

/**
 * WhatsApp-style ticks:
 *  - single grey check  : sent (server confirmed, nobody else has read)
 *  - double grey check  : delivered (at least one person has read it)
 *  - double blue check  : read by everyone
 */
export function MessageStatus({ readCount, otherMembers }: Props) {
  if (otherMembers <= 0) {
    return <Check className="h-3 w-3" />;
  }
  if (readCount <= 0) {
    return <Check className="h-3 w-3" />;
  }
  if (readCount >= otherMembers) {
    return <CheckCheck className="h-3 w-3 text-sky-400" />;
  }
  return <CheckCheck className="h-3 w-3" />;
}
