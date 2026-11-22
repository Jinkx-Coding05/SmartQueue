export interface OtpDeliveryProvider {
  sendVerificationCode(email: string, code: string): Promise<boolean>
}

// No provider is configured yet; returning false keeps registration honest and lets local development use explicit debug mode.
export class UnconfiguredOtpDeliveryProvider implements OtpDeliveryProvider {
  async sendVerificationCode(_email: string, _code: string): Promise<boolean> {
    return false
  }
}
