import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import {
  FeatureKeySchema,
  type FeatureKey,
  type PlanKey,
} from '@marketos/shared';

// Public API keys are stable; these slugs match the instance's verified Clerk catalog.
const CLERK_FEATURE_SLUGS: Record<FeatureKey, readonly string[]> = {
  content_generation: [
    'basic_ai_content_generation_allowance',
    'higher_ai_content_and_image_generation_allowances',
  ],
  image_generation: [
    'trial_ai_image_generation_allowance',
    'higher_ai_content_and_image_generation_allowances',
  ],
  brand_brief: ['brand_brief_for_each_project', 'everything_in_free'],
  personalization: [
    'personal_preferences_and_references',
    'everything_in_free',
  ],
  content_calendar: ['content_drafts_and_calendar', 'everything_in_free'],
  more_projects: ['increased_project_limit'],
  strong_model: ['access_to_advanced_ai_models'],
  expanded_references: ['expanded_reference_and_media_storage'],
  channel_publishing: ['channel_connections_and_scheduled_publishing'],
  ai_assistant: ['project_aware_ai_assistant'],
  content_analytics: ['content_performance_analytics'],
  automation: ['marketing_automation'],
};

@Injectable()
export class ClerkGateway {
  private instance?: ReturnType<typeof createClerkClient>;
  constructor(private readonly config: ConfigService) {}

  client(): ReturnType<typeof createClerkClient> {
    if (this.instance) return this.instance;
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    const publishableKey = this.config.get<string>('CLERK_PUBLISHABLE_KEY');
    if (!secretKey || !publishableKey) throw new ServiceUnavailableException();
    this.instance = createClerkClient({ secretKey, publishableKey });
    return this.instance;
  }

  async authenticate(authorization: string) {
    const client = this.client();
    const origin = new URL(this.config.getOrThrow<string>('WEB_URL')).origin;
    const state = await client.authenticateRequest(
      new Request(origin, {
        headers: { Authorization: authorization },
      }),
      { authorizedParties: [origin], acceptsToken: 'session_token' },
    );
    const auth = state.toAuth();
    if (
      !auth ||
      !auth.isAuthenticated ||
      !auth.userId ||
      auth.sessionClaims?.azp !== origin
    )
      throw new UnauthorizedException();
    // MarketOS bills individual users, not an active Clerk organization.
    const plan: PlanKey = auth.has({ plan: 'u:max' })
      ? 'max'
      : auth.has({ plan: 'u:pro' })
        ? 'pro'
        : 'free';
    return {
      clerkId: auth.userId,
      plan,
      features: FeatureKeySchema.options.filter((feature) =>
        CLERK_FEATURE_SLUGS[feature].some((slug) =>
          auth.has({ feature: `u:${slug}` }),
        ),
      ),
    };
  }

  async profile(clerkId: string) {
    try {
      const profile = await this.client().users.getUser(clerkId);
      return {
        email:
          profile.emailAddresses.find(
            (email) => email.id === profile.primaryEmailAddressId,
          )?.emailAddress ?? null,
        name:
          [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
          null,
      };
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  // Worker has no session JWT: refresh the individual user's subscription from Clerk.
  async automationEntitled(clerkId: string): Promise<boolean> {
    const subscription =
      await this.client().billing.getUserBillingSubscription(clerkId);
    const now = Date.now();
    return subscription.subscriptionItems.some(
      (item) =>
        item.plan?.slug === 'max' &&
        ['active', 'canceled'].includes(item.status) &&
        (item.periodEnd === null || item.periodEnd > now) &&
        item.endedAt === null &&
        item.plan.features.some(
          (feature) => feature.slug === 'marketing_automation',
        ),
    );
  }
}
