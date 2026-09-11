/**
 * Sri Jayawardenepura Time (Asia/Colombo / UTC+05:30) Utility Functions
 */

const SRI_LANKA_TIMEZONE = "Asia/Colombo";

/**
 * Parses any date-like input (ISO string, Timestamp number, Firestore Timestamp, Date object)
 * into a valid JavaScript Date.
 */
export function parseToDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "object" && typeof val.toDate === "function") {
    return val.toDate();
  }
  if (typeof val === "object" && val.seconds !== undefined) {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Format any date/timestamp into Sri Jayawardenepura DateTime: "YYYY-MM-DD hh:mm:ss A"
 * e.g. "2026-09-11 02:45:52 PM"
 */
export function formatSriLankaDateTime(val, fallback = "-") {
  const d = parseToDate(val);
  if (!d) return fallback;

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: SRI_LANKA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const parts = formatter.formatToParts(d);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || "";

    const day = getPart("day");
    const month = getPart("month");
    const year = getPart("year");
    let hour = getPart("hour");
    const minute = getPart("minute");
    const second = getPart("second");
    const dayPeriod = (getPart("dayPeriod") || "").toUpperCase();

    return `${year}-${month}-${day} ${hour}:${minute}:${second} ${dayPeriod}`.trim();
  } catch (err) {
    console.error("Error formatting Sri Lanka DateTime:", err);
    return d.toLocaleString("en-GB", { timeZone: SRI_LANKA_TIMEZONE });
  }
}

/**
 * Format date into Sri Jayawardenepura Date: "YYYY-MM-DD"
 */
export function formatSriLankaDate(val, fallback = "-") {
  const d = parseToDate(val);
  if (!d) return fallback;

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SRI_LANKA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(d);
  } catch (err) {
    return d.toISOString().split("T")[0];
  }
}

/**
 * Format date into Sri Jayawardenepura Time: "hh:mm:ss A"
 * e.g. "02:45:52 PM"
 */
export function formatSriLankaTime(val, fallback = "-") {
  const d = parseToDate(val);
  if (!d) return fallback;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: SRI_LANKA_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
    return formatter.format(d);
  } catch (err) {
    return d.toLocaleTimeString("en-US", { timeZone: SRI_LANKA_TIMEZONE });
  }
}

/**
 * Returns current timestamp formatted in Sri Jayawardenepura Time
 */
export function getSriLankaNowFormatted() {
  return formatSriLankaDateTime(new Date());
}
