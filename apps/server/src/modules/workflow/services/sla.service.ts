/**
 * SLA Service for ARTA computations.
 * ARTA transaction categories:
 * - Simple: <= 3 working days
 * - Complex: <= 7 working days
 * - Highly Technical: <= 20 working days
 */

export class SlaService {
  /**
   * TODO: Implement holiday fetch from Platform Administrator config table.
   * Currently stubs to an empty array. Holiday calendar migration belongs to
   * the platform admin module.
   */
  async getHolidays(): Promise<Date[]> {
    return [];
  }

  /**
   * Walks forward from startDate, skipping Sat/Sun and configured holidays,
   * until workingDays business days have elapsed.
   */
  async computeSlaDeadline(startDate: Date, workingDays: number): Promise<Date> {
    const holidays = await this.getHolidays();
    const holidayStrings = new Set(holidays.map((d) => d.toISOString().split('T')[0]));

    const deadline = new Date(startDate);
    let daysToAdd = workingDays;

    while (daysToAdd > 0) {
      deadline.setDate(deadline.getDate() + 1);

      const dayOfWeek = deadline.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

      // Use local YYYY-MM-DD for simpler checking
      const localDateStr = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`;
      const isHoliday = holidayStrings.has(localDateStr);

      if (!isWeekend && !isHoliday) {
        daysToAdd--;
      }
    }

    return deadline;
  }

  /**
   * Counts business days between startDate and now, excluding Sat/Sun and holidays.
   */
  async elapsedWorkingDays(startDate: Date, now: Date): Promise<number> {
    const holidays = await this.getHolidays();
    const holidayStrings = new Set(holidays.map((d) => d.toISOString().split('T')[0]));

    let count = 0;
    const current = new Date(startDate);

    // Normalize times to midnight for date-only comparison
    current.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);

    while (current < end) {
      current.setDate(current.getDate() + 1);

      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const localDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const isHoliday = holidayStrings.has(localDateStr);

      if (!isWeekend && !isHoliday) {
        count++;
      }
    }

    return count;
  }
}
