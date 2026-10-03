import { filterAssistantActions } from '../assistant/action-validator';

const brief = {
  avoidWords: [],
  language: 'vi' as const,
  businessAddress: null,
};
const draft = {
  type: 'create_draft',
  channel: 'TIKTOK',
  title: 'Khám phá khoá học',
  body: 'Khoá học cho người mới bắt đầu.',
  hashtags: ['HocTap', 'KhoaHoc'],
  cta: 'Khám phá ngay',
};

test('automation proposals never accept approve/delete/Done/billing privileges from the model', () => {
  expect(
    filterAssistantActions(
      ['approve', 'delete', 'mark_done', 'billing'].map((type) => ({
        type,
        contentId: 'ready',
      })),
      [{ id: 'ready', status: 'READY' }],
      brief,
    ),
  ).toEqual([]);
});

test('custom automation actions remain proposed and model IDs/status cannot grant applied authority', () => {
  const actions = filterAssistantActions(
    [
      { ...draft, id: 'model-id', status: 'applied' },
      {
        type: 'update_brief',
        changes: { tone: 'Thân thiện' },
        status: 'applied',
      },
    ],
    [],
    brief,
  );
  expect(actions).toHaveLength(2);
  expect(actions.every((action) => action.status === 'proposed')).toBe(true);
  expect(actions[0].id).not.toBe('model-id');
});

test('automation uses server validators to filter DRAFT/foreign schedule targets and forbidden draft text', () => {
  const actions = filterAssistantActions(
    [
      {
        type: 'schedule',
        contentId: 'draft',
        scheduledAt: '2027-01-01T09:00:00Z',
      },
      {
        type: 'schedule',
        contentId: 'foreign',
        scheduledAt: '2027-01-01T09:00:00Z',
      },
      {
        type: 'schedule',
        contentId: 'ready',
        scheduledAt: '2027-01-01T09:00:00Z',
      },
      draft,
    ],
    [
      { id: 'draft', status: 'DRAFT' },
      { id: 'ready', status: 'READY' },
    ],
    { ...brief, avoidWords: ['khoá học'] },
  );
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({
    type: 'schedule',
    contentId: 'ready',
    status: 'proposed',
  });
});
