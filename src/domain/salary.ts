import type { SalaryType } from "./roles";

export interface SalaryCalculationInput {
  staffName: string;
  locationName: string;
  salaryAmount: number | null;
  salaryType: SalaryType | null;
  workedDays: number;
  daysInMonth: number;
}

export interface SalaryCalculationRow {
  staffName: string;
  locationName: string;
  salaryLabel: string;
  monthlySalary: number | null;
  dailyRate: number;
  workedDays: number;
  requiredDays: number;
  extraDays: number;
  payableSalary: number;
  calculation: string;
}

export function daysInMonthForDate(dateKey: string): number {
  const [year, month] = dateKey.split("-").map(Number);
  if (!year || !month) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calculateSalaryRow(input: SalaryCalculationInput): SalaryCalculationRow {
  const requiredDays = Math.max(0, input.daysInMonth - 4);
  const salaryAmount = input.salaryAmount ?? 0;

  if (!input.salaryAmount || !input.salaryType) {
    return {
      staffName: input.staffName,
      locationName: input.locationName,
      salaryLabel: "Not configured",
      monthlySalary: input.salaryAmount,
      dailyRate: 0,
      workedDays: input.workedDays,
      requiredDays,
      extraDays: 0,
      payableSalary: 0,
      calculation: "Salary amount/type is not configured.",
    };
  }

  if (input.salaryType === "daily") {
    const payableSalary = roundCurrency(input.workedDays * salaryAmount);
    return {
      staffName: input.staffName,
      locationName: input.locationName,
      salaryLabel: "Daily",
      monthlySalary: null,
      dailyRate: salaryAmount,
      workedDays: input.workedDays,
      requiredDays,
      extraDays: 0,
      payableSalary,
      calculation: `${formatNumber(input.workedDays)} worked days x ${formatCurrency(salaryAmount)} daily salary = ${formatCurrency(payableSalary)}.`,
    };
  }

  const dailyRate = roundCurrency(salaryAmount / input.daysInMonth);
  const extraDays = Math.max(0, input.workedDays - requiredDays);
  const basePay = input.workedDays >= requiredDays ? salaryAmount : dailyRate * input.workedDays;
  const extraPay = extraDays * dailyRate;
  const payableSalary = roundCurrency(basePay + extraPay);
  const baseStep = input.workedDays >= requiredDays
    ? `Worked ${formatNumber(input.workedDays)} days, meeting ${formatNumber(requiredDays)} required days, so base salary is ${formatCurrency(salaryAmount)}`
    : `Worked ${formatNumber(input.workedDays)} days below ${formatNumber(requiredDays)} required days, so pay is prorated at ${formatCurrency(dailyRate)} per day`;
  const extraStep = extraDays > 0
    ? `; extra pay is ${formatNumber(extraDays)} x ${formatCurrency(dailyRate)} = ${formatCurrency(extraPay)}`
    : "";

  return {
    staffName: input.staffName,
    locationName: input.locationName,
    salaryLabel: "Monthly",
    monthlySalary: salaryAmount,
    dailyRate,
    workedDays: input.workedDays,
    requiredDays,
    extraDays,
    payableSalary,
    calculation: `${baseStep}${extraStep}; total ${formatCurrency(payableSalary)}.`,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number): string {
  return value.toLocaleString([], {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
