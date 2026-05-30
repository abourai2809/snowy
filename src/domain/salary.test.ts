import { describe, expect, it } from "vitest";
import { calculateSalaryRow, daysInMonthForDate } from "./salary";

describe("salary", () => {
  it("calculates monthly salary plus extra days by calendar daily rate", () => {
    const row = calculateSalaryRow({
      staffName: "Priya",
      locationName: "Malsi",
      salaryAmount: 31000,
      salaryType: "monthly",
      workedDays: 29,
      daysInMonth: 31,
    });

    expect(row.requiredDays).toBe(27);
    expect(row.dailyRate).toBe(1000);
    expect(row.extraDays).toBe(2);
    expect(row.payableSalary).toBe(33000);
    expect(row.calculation).toContain("extra pay is 2 x 1,000.00");
  });

  it("uses the actual number of days in the salary month", () => {
    expect(daysInMonthForDate("2026-01-15")).toBe(31);
    expect(daysInMonthForDate("2026-09-15")).toBe(30);
  });
});
