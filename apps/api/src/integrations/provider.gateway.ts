import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Provider = 'facebook' | 'linkedin';
export type TokenSet = { accessToken: string; expiresAt: string | null };
export type ProviderPage = {
  id: string;
  name: string;
  avatarUrl: string | null;
  accessToken: string;
};
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
      provider === 'facebook' ? 'META_APP_ID' : 'LINKEDIN_CLIENT_ID',
    );
    const secret = this.config.get<string>(
      provider === 'facebook' ? 'META_APP_SECRET' : 'LINKEDIN_CLIENT_SECRET',
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
  authorize(provider: Provider, state: string): string {
    const { clientId, redirect } = this.details(provider);
    const base =
      provider === 'facebook'
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
          : 'openid profile w_member_social',
    });
    return `${base}?${query.toString()}`;
  }
  private async request(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
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
      provider === 'facebook'
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
  async facebookPages(accessToken: string): Promise<ProviderPage[]> {
    const query = new URLSearchParams({
      fields: 'id,name,access_token,picture{url}',
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
        }[];
        paging?: { cursors?: { after?: string }; next?: string };
      }>(
        await this.request(
          `https://graph.facebook.com/${this.metaVersion}/me/accounts?${query.toString()}`,
        ),
      ); // NOSONAR: cursor request depends on the previous provider response.
      pages.push(
        ...data.data.map((page) => ({
          id: page.id,
          name: page.name,
          avatarUrl: page.picture?.data?.url ?? null,
          accessToken: page.access_token,
        })),
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
    channel: 'FACEBOOK' | 'LINKEDIN',
    accountId: string,
    token: string,
    text: string,
  ): Promise<{ id: string; url: string | null }> {
    if (channel === 'FACEBOOK') {
      const response = await this.request(
        `https://graph.facebook.com/${this.metaVersion}/${encodeURIComponent(accountId)}/feed`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ message: text }),
        },
      );
      const data = await this.json<{ id: string }>(response);
      return { id: data.id, url: `https://www.facebook.com/${data.id}` };
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
  async revoke(provider: Provider, token: string): Promise<void> {
    if (provider !== 'facebook') return; // LinkedIn self-serve has no supported revoke endpoint.
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
