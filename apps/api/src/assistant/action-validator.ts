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

function targetError(action: AssistantAction, states: Map<string, string>) {
  if (action.type === 'schedule')
    return !states.has(action.contentId) ||
      states.get(action.contentId) === 'DRAFT'
      ? 'FOREIGN_OR_DRAFT_TARGET'
      : null;
  if (action.type === 'edit_content' || action.type === 'attach_media')
    return !states.has(action.contentId) ||
      states.get(action.contentId) === 'DONE'
      ? 'FOREIGN_OR_DONE_TARGET'
      : null;
  if (action.type === 'generate_image' && action.attachToContentId)
    return !states.has(action.attachToContentId) ||
      states.get(action.attachToContentId) === 'DONE'
      ? 'FOREIGN_OR_DONE_TARGET'
      : null;
  return null;
}

function mediaError(action: AssistantAction, assetIds: Set<string>) {
  if (
    (action.type === 'attach_media' ||
      action.type === 'create_draft' ||
      action.type === 'edit_content') &&
    action.assetIds?.some((id) => !assetIds.has(id))
  )
    return 'FOREIGN_ASSET';
  return null;
}

function draftErrors(
  action: Extract<AssistantAction, { type: 'create_draft' }>,
  brief: {
    avoidWords: string[];
    language: ContentLanguage;
    businessAddress: string | null;
  },
) {
  return validateVariants(
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
}

export function filterAssistantActions(
  raw: unknown[],
  contents: { id: string; status: string }[],
  brief: {
    avoidWords: string[];
    language: ContentLanguage;
    businessAddress: string | null;
  },
  rejected: RejectedAssistantAction[] = [],
  assets: { id: string }[] = [],
): AssistantAction[] {
  const states = new Map(contents.map((item) => [item.id, item.status]));
  const assetIds = new Set(assets.map((asset) => asset.id));
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
    const target = targetError(action, states);
    if (target) return reject(action.type, [target]);
    const media = mediaError(action, assetIds);
    if (media) return reject(action.type, [media]);
    if (action.type === 'create_draft') {
      const errors = draftErrors(action, brief);
      if (errors.length) return reject(action.channel, errors, true);
    }
    return [action];
  });
}
