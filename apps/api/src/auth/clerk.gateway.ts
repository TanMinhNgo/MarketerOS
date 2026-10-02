import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { FeatureKeySchema, type PlanKey } from '@marketos/shared';

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
    const plan: PlanKey = auth.has({ plan: 'u:pro' }) ? 'pro' : 'free';
    return {
      clerkId: auth.userId,
      plan,
      features: FeatureKeySchema.options.filter((feature) =>
        auth.has({ feature: `u:${feature}` }),
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
}
