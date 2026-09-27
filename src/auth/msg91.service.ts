import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Msg91Response {
  type?: string;
  message?: string;
  request_id?: string;
  [key: string]: unknown;
}

@Injectable()
export class Msg91Service {
  constructor(private readonly config: ConfigService) {}

  private isSuccessfulMsg91Response(response: Msg91Response): boolean {
    const type = String(response.type ?? '').toLowerCase();
    const message = String(response.message ?? '').toLowerCase();

    return (
      type === 'success' ||
      message.includes('success') ||
      message.includes('verified') ||
      Boolean(response.request_id)
    );
  }

  async sendOtp(
    internationalMobile: string,
  ): Promise<Msg91Response> {
    const authKey =
      this.config.getOrThrow<string>('MSG91_AUTH_KEY');

    const templateId =
      this.config.getOrThrow<string>('MSG91_OTP_TEMPLATE_ID');

    const url = new URL(
      'https://control.msg91.com/api/v5/otp',
    );

    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', internationalMobile);
    url.searchParams.set('authkey', authKey);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const result = (await response.json()) as Msg91Response;

    console.log('MSG91 SEND OTP:', result);

    if (
      !response.ok ||
      !this.isSuccessfulMsg91Response(result)
    ) {
      console.error('MSG91 send OTP error:', result);

      throw new BadGatewayException({
        status: false,
        message: String(
          result.message ?? 'Unable to send OTP',
        ),
        provider: result,
      });
    }

    return result;
  }

  async resendOtp(
    internationalMobile: string,
  ): Promise<Msg91Response> {
    const authKey =
      this.config.getOrThrow<string>('MSG91_AUTH_KEY');

    const url = new URL(
      'https://control.msg91.com/api/v5/otp/retry',
    );

    url.searchParams.set('mobile', internationalMobile);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('retrytype', 'text');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const result = (await response.json()) as Msg91Response;

    console.log('MSG91 RESEND OTP:', result);

    if (
      !response.ok ||
      !this.isSuccessfulMsg91Response(result)
    ) {
      console.error('MSG91 resend OTP error:', result);

      throw new BadGatewayException({
        status: false,
        message: String(
          result.message ?? 'Unable to resend OTP',
        ),
        provider: result,
      });
    }

    return result;
  }

  async verifyOtp(
    internationalMobile: string,
    otp: string,
  ): Promise<Msg91Response> {
    const authKey =
      this.config.getOrThrow<string>('MSG91_AUTH_KEY');

    const url = new URL(
      'https://control.msg91.com/api/v5/otp/verify',
    );

    url.searchParams.set('mobile', internationalMobile);
    url.searchParams.set('otp', otp);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authkey: authKey,
      },
    });

    const result = (await response.json()) as Msg91Response;

    console.log('MSG91 VERIFY OTP:', result);

    if (
      !response.ok ||
      !this.isSuccessfulMsg91Response(result)
    ) {
      console.error('MSG91 verify OTP error:', result);

      throw new Error(
        String(result.message ?? 'Invalid or expired OTP'),
      );
    }

    return result;
  }
}