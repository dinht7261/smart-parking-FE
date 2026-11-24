
/**
 * Xác định các đêm có giao với thời gian đặt xe.
 *
 * Mỗi đêm: 22:00 đến 06:00 sáng hôm sau.
 * Khoảng thời gian sử dụng quy tắc [from, to).
 *
 * Trả về ngày bắt đầu của từng đêm, dạng YYYY-MM-DD.
 *
 * Ví dụ:
 * 21/11 21:00 -> 22/11 01:00
 * Trả về: ['2026-11-21']
 */

export function overnightDatesInRange(
  from: string | Date,
  to: string | Date
): string[] {

  const start = new Date(from);
  const end = new Date(to);

  const startMs = start.getTime();
  const endMs = end.getTime();

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return [];
  }

  const result: string[] = [];

  const pad = (value: number): string =>
    String(value).padStart(2, '0');

  // Bắt đầu xét từ ngày hôm trước
  // để nhận diện cả booking lúc 00:00–06:00.

  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() - 1
  );

  // Giới hạn vòng lặp để tránh xử lý
  // khoảng thời gian quá dài.
  for (
    let index = 0;
    index < 35 && cursor.getTime() < endMs;
    index++
  ) {

    const nightStart = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      22, 0, 0, 0
    );

    const nightEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      6, 0, 0, 0
    );

    // Kiểm tra hai khoảng thời gian giao nhau.
    const overlaps =
      startMs < nightEnd.getTime() &&
      endMs > nightStart.getTime();

    if (overlaps) {

      const date =
        `${nightStart.getFullYear()}-` +
        `${pad(nightStart.getMonth() + 1)}-` +
        `${pad(nightStart.getDate())}`;

      result.push(date);
    }

    cursor.setDate(
      cursor.getDate() + 1
    );
  }

  return result;
}

export function firstOvernightWindow(
  value: string | Date
): {
  nightDate: string;
  nextDate: string;
} | null {

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  // Nếu xe vào trước 06:00,
  // tính theo đêm của ngày hôm trước.

  if (date.getHours() < 6) {
    date.setDate(date.getDate() - 1);
  }

  const next = new Date(date.getTime());

  next.setDate(next.getDate() + 1);

  const format = (d: Date): string => {

    const year = d.getFullYear();

    const month = String(
      d.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      d.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;

  };

  return {
    nightDate: format(date),
    nextDate: format(next)
  };

}

