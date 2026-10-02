import type { GenerateContentInput, GeneratedVariant } from '@marketos/shared';
import { channelPrompts } from './channel-prompts';

type Channel = GenerateContentInput['channel'];

const words = (value: string) => value.trim().match(/\S+/gu)?.length ?? 0;
const characters = (value: string) => [...value].length;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gu, 'd')
    .replace(/Đ/gu, 'D')
    .toLocaleLowerCase('vi')
    .replace(/\s+/gu, ' ')
    .trim();

export function containsAvoidWord(
  variant: Partial<GeneratedVariant>,
  avoidWords: string[],
): boolean {
  const content = [
    variant.title,
    variant.body,
    ...(variant.hashtags ?? []),
    variant.cta,
  ]
    .filter(Boolean)
    .join(' ');
  const normalized = normalize(content);
  return avoidWords.some(
    (word) => word.trim() && normalized.includes(normalize(word)),
  );
}

export function validateVariants(
  variants: GeneratedVariant[],
  channel: Channel,
  avoidWords: string[],
  businessAddress: string | null = null,
): string[] {
  const spec = channelPrompts[channel];
  const { limits } = spec;
  const errors: string[] = [];
  if (variants.length !== 3) errors.push('Phải có đúng 3 biến thể.');
  for (const [index, variant] of variants.entries()) {
    const field = (name: string) => `variants[${index}].${name}`;
    if (
      limits.titleMax !== undefined &&
      characters(variant.title) > limits.titleMax
    )
      errors.push(`${field('title')} quá ${limits.titleMax} ký tự.`);
    if (limits.bodyMin !== undefined && words(variant.body) < limits.bodyMin)
      errors.push(`${field('body')} dưới ${limits.bodyMin} từ.`);
    if (limits.bodyMax !== undefined && words(variant.body) > limits.bodyMax)
      errors.push(`${field('body')} quá ${limits.bodyMax} từ.`);
    if (
      limits.captionMax !== undefined &&
      characters(variant.body) > limits.captionMax
    )
      errors.push(`${field('body')} quá ${limits.captionMax} ký tự.`);
    if (
      variant.hashtags.length < limits.hashtagsMin ||
      variant.hashtags.length > limits.hashtagsMax
    )
      errors.push(
        `${field('hashtags')} phải có ${limits.hashtagsMin}–${limits.hashtagsMax} thẻ.`,
      );
    if (variant.hashtags.some((hashtag) => hashtag.includes('#')))
      errors.push(`${field('hashtags')} chứa dấu #.`);
    if (
      new Set(variant.hashtags.map(normalize)).size !== variant.hashtags.length
    )
      errors.push(`${field('hashtags')} có thẻ trùng.`);
    if (containsAvoidWord(variant, avoidWords))
      errors.push(`${field('avoidWords')} chứa từ/cụm bị cấm.`);
    const body = normalize(variant.body);
    if (/#[\p{L}\p{N}_]+/u.test(variant.body))
      errors.push(`${field('body')} chứa hashtag.`);
    if (
      variant.hashtags.some(
        (hashtag) => hashtag.trim() && body.includes(normalize(hashtag)),
      )
    )
      errors.push(`${field('body')} lặp lại hashtag.`);
    if (variant.cta.trim() && body.includes(normalize(variant.cta)))
      errors.push(`${field('body')} lặp lại CTA.`);
    if (channel === 'FACEBOOK' && words(variant.body.split(/\r?\n/u)[0]) >= 20)
      errors.push(`${field('body')} hook phải dưới 20 từ.`);
    if (channel === 'TIKTOK' && words(variant.title) > 10)
      errors.push(`${field('title')} quá 10 từ.`);
    if (channel === 'YOUTUBE' && Buffer.byteLength(variant.body, 'utf8') > 5000)
      errors.push(`${field('body')} quá 5.000 byte UTF-8.`);
    if (channel === 'EMAIL') {
      const preview = variant.body.split(/\r?\n/u)[0];
      if (characters(preview) >= 90)
        errors.push(`${field('body')} preview phải dưới 90 ký tự.`);
      if (!variant.body.includes('{{unsubscribe_link}}'))
        errors.push(`${field('body')} thiếu {{unsubscribe_link}}.`);
      const address = businessAddress ?? '[Địa chỉ doanh nghiệp]';
      if (!variant.body.includes(address))
        errors.push(`${field('body')} thiếu ${address}.`);
      if (!variant.body.includes('[Tên doanh nghiệp]'))
        errors.push(`${field('body')} thiếu [Tên doanh nghiệp].`);
    }
  }
  return errors;
}
