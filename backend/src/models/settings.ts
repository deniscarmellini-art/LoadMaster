export interface SettingsEntity {
  id: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Operator extends SettingsEntity { code: string; name: string }
export interface Trailer extends SettingsEntity { plate:string;description:string;nextInspectionDate:string|null;disabled:boolean;disabledReason:string|null;disabledAt:string|null }
export interface Carrier extends SettingsEntity { name: string }
export interface OperationalSetting { key:string; value:string; description:string; active:boolean; sortOrder:number; createdAt:string; updatedAt:string }

export interface OperatorInput { id?: string; code: string; name: string; active?: boolean; sortOrder?: number }
export interface TrailerInput { id?:string;plate:string;description:string;active?:boolean;sortOrder?:number;nextInspectionDate?:string|null }
export interface CarrierInput { id?: string; name: string; active?: boolean; sortOrder?: number }
export interface OperationalSettingInput { key:string; value:string; description:string; active?:boolean; sortOrder?:number }
