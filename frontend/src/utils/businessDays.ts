export interface BusinessDay {
  iso: string;
  date: Date;
}

export const getNextBusinessDays = (today: Date, count = 5): BusinessDay[] => {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days: BusinessDay[] = [];
  while (days.length < count) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      days.push({ iso: `${year}-${month}-${day}`, date: new Date(cursor) });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};
