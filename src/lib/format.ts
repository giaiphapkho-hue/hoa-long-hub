export const fmtMoney = (n: number | null | undefined, ccy = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(Number(n ?? 0));
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
export const fmtNumber = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US").format(Number(n ?? 0));
