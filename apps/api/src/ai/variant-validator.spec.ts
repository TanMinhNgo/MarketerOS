import type { GenerateContentInput, GeneratedVariant } from '@marketos/shared';
import { validateVariants } from './variant-validator';

type Channel = GenerateContentInput['channel'];
const repeat = (count: number) => Array(count).fill('nội-dung').join(' ');
const variant = (body: string, hashtags: string[] = []) => ({
  title: 'Tiêu đề',
  body,
  hashtags,
  cta: 'Khám phá ngay',
});
const base: Record<Channel, GeneratedVariant> = {
  FACEBOOK: variant(`Hook ngắn\n${repeat(80)}`, ['ThẻMột', 'ThẻHai']),
  INSTAGRAM: variant(repeat(40), ['ThẻMột', 'ThẻHai', 'ThẻBa']),
  TIKTOK: variant('Video mới', ['ThẻMột', 'ThẻHai']),
  LINKEDIN: variant(repeat(100)),
  YOUTUBE: variant('Mô tả video'),
  EMAIL: variant(
    'Preview ngắn\nXin chào,\nNội dung email.\nTên doanh nghiệp\n[Địa chỉ doanh nghiệp]\n{{unsubscribe_link}}',
  ),
  BLOG: variant(repeat(500), ['ThẻMột', 'ThẻHai']),
};
const check = (
  channel: Channel,
  changed: Partial<GeneratedVariant>,
  avoidWords: string[] = [],
) =>
  validateVariants(
    [{ ...base[channel], ...changed }, base[channel], base[channel]],
    channel,
    avoidWords,
  );

test.each(Object.keys(base) as Channel[])(
  '%s accepts a valid variant',
  (channel) => {
    expect(check(channel, {})).toEqual([]);
  },
);

test('requires exactly three variants', () => {
  expect(validateVariants([base.TIKTOK], 'TIKTOK', []).join(' ')).toContain(
    'đúng 3 biến thể',
  );
});

test.each([
  ['FACEBOOK', 'body', { body: `Hook\n${repeat(78)}` }, 'dưới 80 từ'],
  ['FACEBOOK', 'body', { body: `Hook\n${repeat(150)}` }, 'quá 150 từ'],
  ['INSTAGRAM', 'body', { body: repeat(39) }, 'dưới 40 từ'],
  ['INSTAGRAM', 'body', { body: repeat(101) }, 'quá 100 từ'],
  [
    'INSTAGRAM',
    'body',
    { body: `${'a'.repeat(2201)} ${repeat(40)}` },
    'quá 2200 ký tự',
  ],
  ['TIKTOK', 'body', { body: 'a'.repeat(150) }, 'quá 149 ký tự'],
  ['TIKTOK', 'title', { title: repeat(11) }, 'quá 10 từ'],
  ['LINKEDIN', 'body', { body: repeat(99) }, 'dưới 100 từ'],
  ['LINKEDIN', 'body', { body: repeat(201) }, 'quá 200 từ'],
  [
    'LINKEDIN',
    'body',
    { body: `${'x'.repeat(3000)} ${repeat(100)}` },
    'quá 3000 ký tự',
  ],
  ['YOUTUBE', 'title', { title: 'a'.repeat(70) }, 'quá 69 ký tự'],
  ['YOUTUBE', 'body', { body: 'ộ'.repeat(2501) }, 'quá 5.000 byte'],
  ['EMAIL', 'title', { title: 'a'.repeat(50) }, 'quá 49 ký tự'],
  [
    'EMAIL',
    'body',
    { body: `${'a'.repeat(90)}\n[Địa chỉ doanh nghiệp]\n{{unsubscribe_link}}` },
    'preview phải dưới 90 ký tự',
  ],
  ['BLOG', 'title', { title: 'a'.repeat(65) }, 'quá 64 ký tự'],
  ['BLOG', 'body', { body: repeat(499) }, 'dưới 500 từ'],
  ['BLOG', 'body', { body: repeat(801) }, 'quá 800 từ'],
] as const)('%s checks %s limit: %s', (channel, _field, change, expected) => {
  expect(check(channel, change).join(' ')).toContain(expected);
});

test.each([
  ['FACEBOOK', [], 'phải có 2–3 thẻ'],
  ['FACEBOOK', ['Một', 'Hai', 'Ba', 'Bốn'], 'phải có 2–3 thẻ'],
  ['INSTAGRAM', ['Một', 'Hai'], 'phải có 3–5 thẻ'],
  ['TIKTOK', ['Một'], 'phải có 2–4 thẻ'],
  ['LINKEDIN', ['Một', 'Hai', 'Ba', 'Bốn'], 'phải có 0–3 thẻ'],
  ['YOUTUBE', ['Một', 'Hai', 'Ba', 'Bốn'], 'phải có 0–3 thẻ'],
  ['EMAIL', ['Một'], 'phải có 0–0 thẻ'],
  ['BLOG', ['Một'], 'phải có 2–4 thẻ'],
] as const)('%s checks hashtag count', (channel, hashtags, expected) => {
  expect(check(channel, { hashtags: [...hashtags] }).join(' ')).toContain(
    expected,
  );
});

test('rejects #, duplicate hashtags, hashtag and CTA repeated in body', () => {
  expect(check('TIKTOK', { hashtags: ['#Một', 'Hai'] }).join(' ')).toContain(
    'chứa dấu #',
  );
  expect(
    check('TIKTOK', { hashtags: ['Cà Phê', 'ca phe'] }).join(' '),
  ).toContain('thẻ trùng');
  expect(
    check('TIKTOK', {
      body: 'Video ThẻMột',
      hashtags: ['ThẻMột', 'ThẻHai'],
    }).join(' '),
  ).toContain('lặp lại hashtag');
  expect(
    check('TIKTOK', { body: 'Khám phá ngay video mới' }).join(' '),
  ).toContain('lặp lại CTA');
  expect(check('TIKTOK', { body: 'Video #Moi' }).join(' ')).toContain(
    'chứa hashtag',
  );
});

test('avoids words with case and Vietnamese diacritic variants in every field', () => {
  expect(
    check('TIKTOK', { title: 'RE NHAT' }, ['rẻ nhất']).join(' '),
  ).toContain('từ/cụm bị cấm');
  expect(check('TIKTOK', { body: 'RẺ NHẤT' }, ['re nhat']).join(' ')).toContain(
    'từ/cụm bị cấm',
  );
  expect(
    check('TIKTOK', { hashtags: ['Rẻ Nhất', 'Khác'] }, ['re nhat']).join(' '),
  ).toContain('từ/cụm bị cấm');
  expect(check('TIKTOK', { cta: 'RẺ NHẤT' }, ['rẻ nhất']).join(' ')).toContain(
    'từ/cụm bị cấm',
  );
});

test('email footer and unsubscribe placeholder are required', () => {
  expect(
    check('EMAIL', { body: 'Preview\n[Địa chỉ doanh nghiệp]' }).join(' '),
  ).toContain('thiếu {{unsubscribe_link}}');
  expect(
    check('EMAIL', { body: 'Preview\n{{unsubscribe_link}}' }).join(' '),
  ).toContain('thiếu [Địa chỉ doanh nghiệp]');
});

test('facebook first line must be a short hook', () => {
  expect(
    check('FACEBOOK', { body: `${repeat(20)}\n${repeat(80)}` }).join(' '),
  ).toContain('hook phải dưới 20 từ');
});
