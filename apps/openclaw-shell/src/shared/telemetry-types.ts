export interface TelemetryOptions {
  dsn: string;
  appVersion: string;
  environment: 'development' | 'production';
  consent: boolean;
}

export interface TelemetryConfig {
  enabled: boolean;
  consentGiven: boolean;
  consentTimestamp: string | null;
}
