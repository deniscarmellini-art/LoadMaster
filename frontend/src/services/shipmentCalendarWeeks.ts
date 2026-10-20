import dayjs from "dayjs";
import type { ShipmentItem } from "./shipmentsApi";
import { shipmentHasDeparted } from "./shipmentDeparture";

export const calendarTodayInRome = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

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
