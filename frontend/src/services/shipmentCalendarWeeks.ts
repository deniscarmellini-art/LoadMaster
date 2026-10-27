import dayjs from "dayjs";
import type { ShipmentItem } from "./shipmentsApi";
import { shipmentHasDeparted } from "./shipmentDeparture";

export const calendarTodayInRome = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export interface ShipmentCalendarWeek {
  key: string;
  ownerMonth: string;
  monthStart: string | null;
  days: string[];
}

/** Resolves the title from the first visible cell. A month-start marker is valid
 * only when it belongs to that same cell (and therefore the visible week). */
export function shipmentCalendarVisibleMonth(visibleDate:string|null|undefined,monthStartForVisibleCell:string|null|undefined):string|null {
  if(!visibleDate||!dayjs(visibleDate).isValid())return null;
  if(monthStartForVisibleCell&&/^\d{4}-\d{2}$/.test(monthStartForVisibleCell)&&dayjs(`${monthStartForVisibleCell}-01`).isValid())return monthStartForVisibleCell;
  return dayjs(visibleDate).format("YYYY-MM");
}

/** Keeps a calendar cell at the same viewport position after rows are filtered. */
export function shipmentCalendarAnchoredScrollTop(scrollTop:number,currentElementTop:number,anchorElementTop:number):number {
  return scrollTop+currentElementTop-anchorElementTop;
}

/** Builds only the requested months as consecutive Monday-Saturday weeks. */
export function shipmentCalendarWeeks(startMonth:string,endMonth:string):ShipmentCalendarWeek[] {
  if(!/^\d{4}-\d{2}$/.test(startMonth)||!/^\d{4}-\d{2}$/.test(endMonth))return [];
  const start=dayjs(`${startMonth}-01`).startOf("month"),end=dayjs(`${endMonth}-01`).startOf("month");
  if(!start.isValid()||!end.isValid()||start.isAfter(end))return [];
  const months=[];
  for(let month=start;!month.isAfter(end,"month");month=month.add(1,"month"))months.push(month);

  const monthStarts=new Map<string,string>();
  for(const month of months){
    const first=month.date(1),firstVisible=first.day()===0?first.add(1,"day"):first;
    const week=firstVisible.subtract((firstVisible.day()+6)%7,"day").format("YYYY-MM-DD");
    monthStarts.set(week,month.format("YYYY-MM"));
  }

  const weeksByKey=new Map<string,ShipmentCalendarWeek>();
  for(const month of months){
    const first=month.date(1);
    const firstVisible=first.day()===0?first.add(1,"day"):first;
    const firstWeek=firstVisible.subtract((firstVisible.day()+6)%7,"day");
    const monthEnd=month.endOf("month");
    const lastWeek=monthEnd.subtract((monthEnd.day()+6)%7,"day");
    for(let monday=firstWeek;!monday.isAfter(lastWeek,"day");monday=monday.add(7,"day")){
      const key=monday.format("YYYY-MM-DD");
      const monthStart=monthStarts.get(key)??null;
      const existing=weeksByKey.get(key);
      if(existing){
        if(monthStart)existing.monthStart=monthStart;
        continue;
      }
      weeksByKey.set(key,{
        key,
        ownerMonth:month.format("YYYY-MM"),
        monthStart,
        days:Array.from({length:6},(_,weekday)=>monday.add(weekday,"day").format("YYYY-MM-DD")),
      });
    }
  }
  return [...weeksByKey.values()];
}

const monday = (date:string) => {
  const day=dayjs(date).startOf("day");
  return day.subtract((day.day()+6)%7,"day").format("YYYY-MM-DD");
};

/** Display-only grouping; includes Sunday even though the grid shows Monday–Saturday. */
export function completedPastShipmentWeeks(items:readonly ShipmentItem[],today=calendarTodayInRome()):Set<string> {
  const currentWeek=monday(today);
  const groups=new Map<string,ShipmentItem[]>();
  for(const item of items){
    if(!item.plannedDepartureDate || !dayjs(item.plannedDepartureDate).isValid())continue;
    const week=monday(item.plannedDepartureDate);
    groups.set(week,[...(groups.get(week)??[]),item]);
  }
  return new Set([...groups].filter(([week,shipments])=>week<currentWeek&&shipments.length>0&&shipments.every(shipmentHasDeparted)).map(([week])=>week));
}
