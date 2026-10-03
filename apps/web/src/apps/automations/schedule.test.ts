import { describe, expect, it } from "vitest";
import { describeSchedule } from "./schedule";

describe("describeSchedule", () => {
  const tz = "Asia/Ho_Chi_Minh";
  it("mô tả lịch ngày, tuần (sắp xếp thứ) và tháng", () => {
    expect(describeSchedule({ frequency: "daily", time: "09:00", timezone: tz })).toBe("Every day at 09:00 (Asia/Ho_Chi_Minh)");
    expect(describeSchedule({ frequency: "weekly", weekdays: [4, 1], time: "08:30", timezone: tz })).toBe("Every Mon, Thu at 08:30 (Asia/Ho_Chi_Minh)");
    expect(describeSchedule({ frequency: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6], time: "08:30", timezone: tz })).toMatch(/^Every day/);
    expect(describeSchedule({ frequency: "monthly", dayOfMonth: 1, time: "07:00", timezone: tz })).toMatch(/^Monthly on the 1st/);
    expect(describeSchedule({ frequency: "monthly", dayOfMonth: 12, time: "07:00", timezone: tz })).toMatch(/12th/);
    expect(describeSchedule({ frequency: "monthly", dayOfMonth: 22, time: "07:00", timezone: tz })).toMatch(/22nd/);
  });
});
