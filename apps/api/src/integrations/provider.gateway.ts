import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { IntegrationProvider, IntegrationChannel } from '@marketos/shared';

export type PublicationImage = { bytes: Uint8Array; altText: string | null };

export type Provider = Exclude<IntegrationProvider, 'smtp'>;
export type TokenSet = { accessToken: string; expiresAt: string | null };
export type ProviderPage = {
  id: string;
  name: string;
  avatarUrl: string | null;
  accessToken: string;
};
const providerPageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.url({ protocol: /^https$/ }).nullable(),
  accessToken: z.string().min(1),
});
export type FacebookMetric = {
  impressions: bigint | null;
  reach: bigint | null;
  clicks: bigint | null;
  likes: bigint | null;
  comments: bigint | null;
  shares: bigint | null;
};
export type ProviderFailure =
  | 'TOKEN_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'CONTENT_REJECTED'
  | 'PROVIDER_ERROR';
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderFailure,
    readonly retryable = false,
    readonly ambiguous = false,
  ) {
    super(code);
  }
}
export function mapProviderError(
  status: number,
  platformCode?: number,
): ProviderError {
  if (status === 401 || platformCode === 190)
    return new ProviderError('TOKEN_EXPIRED');
  if (status === 403 || platformCode === 200 || platformCode === 10)
    return new ProviderError('PERMISSION_DENIED');
  if (status === 429 || platformCode === 4 || platformCode === 17)
    return new ProviderError('RATE_LIMITED', true);
  if (status === 400 || status === 422)
    return new ProviderError('CONTENT_REJECTED');
  return new ProviderError('PROVIDER_ERROR', false, true);
}

@Injectable()
export class ProviderGateway {
  // Meta Graph v26.0 must be acceptance-tested with a configured Meta app.
  readonly metaVersion = 'v26.0';
  readonly linkedInVersion = '202609';
  constructor(private readonly config: ConfigService) {}
  private details(provider: Provider) {
    const clientId = this.config.get<string>(
      provider === 'facebook'
        ? 'META_APP_ID'
        : provider === 'instagram'
          ? 'INSTAGRAM_APP_ID'
          : 'LINKEDIN_CLIENT_ID',
    );
    const secret = this.config.get<string>(
      provider === 'facebook'
        ? 'META_APP_SECRET'
        : provider === 'instagram'
          ? 'INSTAGRAM_APP_SECRET'
          : 'LINKEDIN_CLIENT_SECRET',
    );
    const base = this.config.get<string>('OAUTH_CALLBACK_BASE');
    if (!clientId || !secret || !base)
      throw new ServiceUnavailableException('Integration provider unavailable');
    return {
      clientId,
      secret,
      redirect: `${base.replace(/\/$/, '')}/api/oauth/${provider}/callback`,
    };
  }
  configured(provider: Provider) {
    try {
      this.details(provider);
      const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
      return !!key && Buffer.from(key, 'base64').length === 32;
    } catch {
      return false;
    }
  }
  authorize(provider: Provider, state: string): string {
    const { clientId, redirect } = this.details(provider);
    const base =
      provider !== 'linkedin'
        ? `https://www.facebook.com/${this.metaVersion}/dialog/oauth`
        : 'https://www.linkedin.com/oauth/v2/authorization';
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      state,
      scope:
        provider === 'facebook'
          ? 'pages_show_list,pages_manage_posts,pages_read_engagement,read_insights'
          : provider === 'instagram'
            ? 'pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish'
            : 'openid profile w_member_social',
    });
    return `${base}?${query.toString()}`;
  }
  private async request(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ProviderError('PROVIDER_ERROR', false, true);
    }
  }
  private async json<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let code: number | undefined;
      try {
        const data = (await response.json()) as { error?: { code?: number } };
        code = data.error?.code;
      } catch {
        /* no provider body */
      }
      throw mapProviderError(response.status, code);
    }
    return (await response.json()) as T;
  }
  async exchange(provider: Provider, code: string): Promise<TokenSet> {
    const { clientId, secret, redirect } = this.details(provider);
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      redirect_uri: redirect,
      code,
      grant_type: 'authorization_code',
    });
    const response =
      provider !== 'linkedin'
        ? await this.request(
            `https://graph.facebook.com/${this.metaVersion}/oauth/access_token?${params.toString()}`,
          )
        : await this.request('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
          });
    const data = await this.json<{ access_token: string; expires_in?: number }>(
      response,
    );
    if (!data.access_token) throw new ProviderError('PROVIDER_ERROR');
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    };
  }
  async facebookPages(
    accessToken: string,
    instagram = false,
  ): Promise<ProviderPage[]> {
    const query = new URLSearchParams({
      fields: instagram
        ? 'id,name,access_token,instagram_business_account{id,username,profile_picture_url}'
        : 'id,name,access_token,picture{url}',
      limit: '100',
      access_token: accessToken,
    });
    const pages: ProviderPage[] = [];
    for (let batch = 0; batch < 20; batch++) {
      const data = await this.json<{
        data: {
          id: string;
          name: string;
          access_token: string;
          picture?: { data?: { url?: string } };
          instagram_business_account?: {
            id: string;
            username?: string;
            profile_picture_url?: string;
          };
        }[];
        paging?: { cursors?: { after?: string }; next?: string };
      }>(
        await this.request(
          `https://graph.facebook.com/${this.metaVersion}/me/accounts?${query.toString()}`,
        ),
      ); // NOSONAR: cursor request depends on the previous provider response.
      pages.push(
        ...data.data
          .filter((page) => !instagram || page.instagram_business_account)
          .map((page) =>
            providerPageSchema.parse({
              id: instagram ? page.instagram_business_account!.id : page.id,
              name: instagram
                ? (page.instagram_business_account!.username ?? page.name)
                : page.name,
              avatarUrl: instagram
                ? (page.instagram_business_account!.profile_picture_url ?? null)
                : (page.picture?.data?.url ?? null),
              accessToken: page.access_token,
            }),
          ),
      );
      if (!data.paging?.next || !data.paging.cursors?.after) return pages;
      query.set('after', data.paging.cursors.after);
    }
    throw new ProviderError('PROVIDER_ERROR');
  }
  async linkedInIdentity(
    accessToken: string,
  ): Promise<{ id: string; name: string; avatarUrl: string | null }> {
    const data = await this.json<{
      sub: string;
      name?: string;
      picture?: string;
    }>(
      await this.request('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return {
      id: data.sub,
      name: data.name ?? 'LinkedIn',
      avatarUrl: data.picture ?? null,
    };
  }
  async publish(
    channel: Exclude<IntegrationChannel, 'EMAIL'>,
    accountId: string,
    token: string,
    text: string,
    images: PublicationImage[] = [],
    imageUrls: string[] = [],
  ): Promise<{ id: string; url: string | null }> {
    if (images.length > 10) throw new ProviderError('CONTENT_REJECTED');
    if (channel === 'INSTAGRAM')
      return this.publishInstagram(accountId, token, text, imageUrls);
    if (channel === 'FACEBOOK') {
      const body = new URLSearchParams({ message: text });
      for (const [index, image] of images.entries()) {
        const form = new FormData();
        form.set('published', 'false');
        form.set(
          'source',
          new Blob([new Uint8Array(image.bytes)], { type: 'image/png' }),
          'image.png',
        );
        if (image.altText)
          form.set('alt_text_custom', image.altText.slice(0, 1000));
        const uploaded = await this.json<unknown>(
          await this.request(
            `https://graph.facebook.com/${this.metaVersion}/${encodeURIComponent(accountId)}/photos`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            },
          ),
        );
        const parsed = z.object({ id: z.string().min(1) }).safeParse(uploaded);
        if (!parsed.success)
          throw new ProviderError('PROVIDER_ERROR', false, true);
        body.set(
          `attached_media[${index}]`,
          JSON.stringify({ media_fbid: parsed.data.id }),
        );
      }
      const response = await this.request(
        `https://graph.facebook.com/${this.metaVersion}/${encodeURIComponent(accountId)}/feed`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );
      const data = z
        .object({ id: z.string().min(1) })
        .safeParse(await this.json<unknown>(response));
      if (!data.success) throw new ProviderError('PROVIDER_ERROR', false, true);
      return {
        id: data.data.id,
        url: `https://www.facebook.com/${data.data.id}`,
      };
    }
    const media = [] as { id: string; altText?: string }[];
    for (const image of images) {
      const id = await this.uploadLinkedInImage(accountId, token, image.bytes);
      media.push({
        id,
        ...(image.altText ? { altText: image.altText.slice(0, 4086) } : {}),
      });
    }
    const response = await this.request('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Linkedin-Version': this.linkedInVersion,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${accountId}`,
        commentary: text,
        ...(media.length
          ? {
              content:
                media.length === 1
                  ? { media: media[0] }
                  : { multiImage: { images: media } },
            }
          : {}),
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!response.ok) {
      await this.json(response);
      throw new ProviderError('PROVIDER_ERROR');
    }
    const id = response.headers.get('x-restli-id');
    if (!id) throw new ProviderError('PROVIDER_ERROR', false, true);
    return {
      id,
      url: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/`,
    };
  }
  private async publishInstagram(
    accountId: string,
    token: string,
    caption: string,
    urls: string[],
  ) {
    if (
      !urls.length ||
      urls.length > 10 ||
      caption.length > 2200 ||
      urls.some((url) => !z.url({ protocol: /^https$/ }).safeParse(url).success)
    )
      throw new ProviderError('CONTENT_REJECTED');
    const base = `https://graph.facebook.com/${this.metaVersion}`;
    // Finish before the worker's five-minute stale-claim recovery can run.
    const deadline = Date.now() + 180_000;
    const post = async (path: string, data: Record<string, string>) => {
      if (Date.now() >= deadline) throw new ProviderError('CONTENT_REJECTED');
      const response = await this.request(
        `${base}/${encodeURIComponent(accountId)}/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(data),
        },
      );
      const parsed = z
        .object({ id: z.string().min(1) })
        .safeParse(await this.json<unknown>(response));
      if (!parsed.success)
        throw new ProviderError('PROVIDER_ERROR', false, true);
      return parsed.data.id;
    };
    const containers: string[] = [];
    for (const url of urls) {
      const id = await post('media', {
        image_url: url,
        ...(urls.length > 1 ? { is_carousel_item: 'true' } : { caption }),
      });
      await this.instagramReady(base, id, token, deadline);
      containers.push(id);
    }
    const container =
      urls.length === 1
        ? containers[0]
        : await post('media', {
            media_type: 'CAROUSEL',
            children: containers.join(','),
            caption,
          });
    if (urls.length > 1)
      await this.instagramReady(base, container, token, deadline);
    const id = await post('media_publish', { creation_id: container });
    // Publication succeeded even if the optional permalink lookup is unavailable.
    let url: string | null = null;
    try {
      const parsed = z
        .object({ permalink: z.url({ hostname: /(^|\.)instagram\.com$/ }) })
        .safeParse(
          await this.json<unknown>(
            await this.request(
              `${base}/${encodeURIComponent(id)}?fields=permalink`,
              { headers: { Authorization: `Bearer ${token}` } },
            ),
          ),
        );
      if (parsed.success) url = parsed.data.permalink;
    } catch {
      /* Keep the confirmed publication ID. */
    }
    return { id, url };
  }
  private async instagramReady(
    base: string,
    id: string,
    token: string,
    deadline: number,
  ) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if (Date.now() >= deadline) throw new ProviderError('CONTENT_REJECTED');
      const parsed = z
        .object({
          status_code: z.enum([
            'FINISHED',
            'IN_PROGRESS',
            'ERROR',
            'EXPIRED',
            'PUBLISHED',
          ]),
        })
        .safeParse(
          await this.json<unknown>(
            await this.request(
              `${base}/${encodeURIComponent(id)}?fields=status_code`,
              { headers: { Authorization: `Bearer ${token}` } },
            ),
          ),
        );
      if (!parsed.success) throw new ProviderError('PROVIDER_ERROR');
      if (parsed.data.status_code === 'FINISHED') return;
      if (parsed.data.status_code !== 'IN_PROGRESS')
        throw new ProviderError('CONTENT_REJECTED');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new ProviderError('CONTENT_REJECTED');
  }
  private async uploadLinkedInImage(
    accountId: string,
    token: string,
    bytes: Uint8Array,
  ) {
    const uploaded = await this.json<unknown>(
      await this.request(
        'https://api.linkedin.com/rest/images?action=initializeUpload',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Linkedin-Version': this.linkedInVersion,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            initializeUploadRequest: { owner: `urn:li:person:${accountId}` },
          }),
        },
      ),
    );
    const parsed = z
      .object({
        value: z.object({
          uploadUrl: z.url(),
          image: z.string().regex(/^urn:li:image:[A-Za-z0-9_-]+$/),
        }),
      })
      .safeParse(uploaded);
    if (!parsed.success) throw new ProviderError('PROVIDER_ERROR');
    const url = new URL(parsed.data.value.uploadUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !(
        url.hostname === 'linkedin.com' ||
        url.hostname.endsWith('.linkedin.com')
      )
    )
      throw new ProviderError('PROVIDER_ERROR');
    const response = await this.request(url.toString(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/png',
      },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) await this.json(response);
    return parsed.data.value.image;
  }
  async revoke(provider: Provider, token: string): Promise<void> {
    if (provider === 'linkedin') return; // LinkedIn self-serve has no supported revoke endpoint.
    const url = `https://graph.facebook.com/${this.metaVersion}/me/permissions`;
    await this.request(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  async facebookMetrics(
    postId: string,
    token: string,
  ): Promise<FacebookMetric> {
    const headers = { Authorization: `Bearer ${token}` };
    const count = (value: unknown): bigint | null =>
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
        ? BigInt(value)
        : null;
    const result: FacebookMetric = {
      impressions: null,
      reach: null,
      clicks: null,
      likes: null,
      comments: null,
      shares: null,
    };
    const fields = new URLSearchParams({
      fields:
        'shares,likes.summary(true).limit(0),comments.summary(true).limit(0)',
    });
    try {
      const post = await this.json<{
        shares?: { count?: number };
        likes?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
      }>(
        await this.request(
          `https://graph.facebook.com/${this.metaVersion}/${encodeURIComponent(postId)}?${fields.toString()}`,
          { headers },
        ),
      );
      result.likes = count(post.likes?.summary?.total_count);
      result.comments = count(post.comments?.summary?.total_count);
      result.shares = count(post.shares?.count);
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'TOKEN_EXPIRED')
        throw error;
    }
    // Meta removed older post_impressions metrics. Unsupported metrics remain null.
    const insightQuery = new URLSearchParams({
      metric: 'post_media_view,post_total_media_view_unique',
    });
    try {
      const insights = await this.json<{
        data?: { name: string; values?: { value?: number }[] }[];
      }>(
        await this.request(
          `https://graph.facebook.com/${this.metaVersion}/${encodeURIComponent(postId)}/insights?${insightQuery.toString()}`,
          { headers },
        ),
      );
      for (const metric of insights.data ?? []) {
        if (metric.name === 'post_media_view')
          result.impressions = count(metric.values?.[0]?.value);
        if (metric.name === 'post_total_media_view_unique')
          result.reach = count(metric.values?.[0]?.value);
      }
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'TOKEN_EXPIRED')
        throw error;
    }
    return result;
  }
}
