/**
 * Recording fake for the SMTP transport — the single mocked boundary in the
 * integration suite (aliased in vitest.config.ts). Everything the app would
 * hand to Gmail lands in `smtp.sent`; failures are programmed per-call with
 * `smtp.failNext` so retry behavior can be exercised.
 */

export type SentMail = {
  from?: string;
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

const sent: SentMail[] = [];
const failures: string[] = [];
let messageCounter = 0;

export const smtp = {
  /** Every mail "delivered" since the last reset, oldest first. */
  sent,
  /** Makes the next `times` sendMail calls throw with `message`. */
  failNext(message: string, times = 1): void {
    for (let i = 0; i < times; i++) failures.push(message);
  },
  reset(): void {
    sent.length = 0;
    failures.length = 0;
    messageCounter = 0;
  },
};

export function createTransport() {
  return {
    async sendMail(input: SentMail): Promise<{ messageId: string }> {
      const failure = failures.shift();
      if (failure) throw new Error(failure);
      sent.push(input);
      messageCounter += 1;
      return { messageId: `<test-${messageCounter}@smtp.fake>` };
    },
  };
}

export default { createTransport };
