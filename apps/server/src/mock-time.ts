import 'dotenv/config';

export function applyTimeMockIfConfigured() {
  const envDate = process.env['MOCK_SYSTEM_DATE'];
  if (process.env['NODE_ENV'] !== 'production' && envDate) {
    const mockDate = new Date(envDate);
    if (!isNaN(mockDate.getTime())) {
      const RealDate = Date;
      const timeDiff = mockDate.getTime() - RealDate.now();

      // Ensure that subsequent calls to new Date() are offset by timeDiff,
      // making time tick naturally from the mocked start date.
      global.Date = class extends RealDate {
        constructor(...args: any[]) {
          if (args.length) {
            // @ts-ignore
            super(...args);
          } else {
            super(RealDate.now() + timeDiff);
          }
        }
      } as DateConstructor;

      global.Date.now = () => RealDate.now() + timeDiff;
      console.warn(`\n======================================================`);
      console.warn(`[DEVELOPMENT] MOCK_SYSTEM_DATE is set.`);
      console.warn(`System time has been shifted to: ${new Date().toISOString()}`);
      console.warn(`======================================================\n`);
    } else {
      console.error(`\n[ERROR] Invalid MOCK_SYSTEM_DATE: ${envDate}. Mock ignored.\n`);
    }
  }
}
