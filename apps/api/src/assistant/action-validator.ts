import { randomUUID } from 'node:crypto';
import {
  AssistantActionSchema,
  type AssistantAction,
  type ContentLanguage,
} from '@marketos/shared';
import { validateVariants } from '../ai/variant-validator';

export type RejectedAssistantAction = {
  index: number;
  channel: string;
  reasons: string[];
  repairable: boolean;
};

export function filterAssistantActions(
  raw: unknown[],
  contents: { id: string; status: string }[],
  brief: {
    avoidWords: string[];
    language: ContentLanguage;
    businessAddress: string | null;
  },
  rejected: RejectedAssistantAction[] = [],
): AssistantAction[] {
  const states = new Map(contents.map((item) => [item.id, item.status]));
  return raw.slice(0, 5).flatMap((proposal, index) => {
    const reject = (channel: string, reasons: string[], repairable = false) => {
      rejected.push({ index, channel, reasons, repairable });
      return [];
    };
    if (!proposal || typeof proposal !== 'object') return [];
    const parsed = AssistantActionSchema.safeParse({
      ...proposal,
      id: randomUUID(),
      status: 'proposed',
    });
    if (!parsed.success) return reject('UNKNOWN', ['INVALID_ACTION_SCHEMA']);
    const action = parsed.data;
    if (
      action.type === 'schedule' &&
      (!states.has(action.contentId) ||
        states.get(action.contentId) === 'DRAFT')
    )
      return reject('schedule', ['FOREIGN_OR_DRAFT_TARGET']);
    if (
      action.type === 'edit_content' &&
      (!states.has(action.contentId) || states.get(action.contentId) === 'DONE')
    )
      return reject('edit_content', ['FOREIGN_OR_DONE_TARGET']);
    if (action.type === 'create_draft') {
      const errors = validateVariants(
        [
          {
            title: action.title,
            body: action.body,
            hashtags: action.hashtags,
            cta: action.cta ?? '',
          },
        ],
        action.channel,
        brief.avoidWords,
        brief.businessAddress,
        brief.language,
        1,
      );
      if (errors.length) return reject(action.channel, errors, true);
    }
    return [action];
  });
}
