function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDisplayTimestamp(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatIsoDate(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

export function formatReportStamp(date) {
  const shortYear = String(date.getFullYear()).slice(-2);
  return [
    shortYear,
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("") + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
