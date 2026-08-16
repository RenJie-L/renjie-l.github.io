import type { HarnessEvent, HarnessEventInput } from './types.ts';

export interface EventSink {
  emit(event: HarnessEventInput): Promise<void>;
}

export function encodeSseEvent(event: HarnessEvent): Uint8Array {
  const payload = [
    `id: ${event.seq}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    '',
    '',
  ].join('\n');
  return new TextEncoder().encode(payload);
}

export class SseEventSink implements EventSink {
  private sequence = 0;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer;
  }

  async emit(input: HarnessEventInput): Promise<void> {
    const event = { ...input, seq: ++this.sequence } as HarnessEvent;
    await this.writer.write(encodeSseEvent(event));
  }
}
