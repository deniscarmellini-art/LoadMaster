export interface PanelQrData {
  commessa: string; cliente: string; numeroPannello: string; camion: string;
  spessore: number; lunghezza: number; altezza: number; peso: number;
}
export interface PackageQrData { codicePacco:string;commessa:string;cliente:string;camion:string;numeroPannelli:number;peso:number;volume:number; }

const requiredKeys = ["C", "CL", "N", "CA", "S", "L", "H", "P"] as const;

export function parsePanelQr(value: string): PanelQrData | null {
  const entries = value.trim().split("|").map((part) => {
    const separator = part.indexOf("=");
    return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] as const : null;
  });
  if (entries.some((entry) => entry === null)) return null;
  const fields = new Map(entries.filter((entry) => entry !== null));
  if (requiredKeys.some((key) => !fields.get(key))) return null;
  const numbers = ["S", "L", "H", "P"].map((key) => Number(fields.get(key)));
  if (numbers.some((number) => !Number.isFinite(number))) return null;
  return { commessa:fields.get("C")!, cliente:fields.get("CL")!, numeroPannello:fields.get("N")!, camion:fields.get("CA")!, spessore:numbers[0]!, lunghezza:numbers[1]!, altezza:numbers[2]!, peso:numbers[3]! };
}

export function parsePackageQr(value:string):PackageQrData|null{const entries=value.trim().split("|").map(part=>{const index=part.indexOf("=");return index>0?[part.slice(0,index),part.slice(index+1)] as const:null;});if(entries.some(entry=>entry===null))return null;const fields=new Map(entries.filter(entry=>entry!==null));if(["PK","C","CL","CA","PZ","KG","MC"].some(key=>!fields.get(key)))return null;const numeroPannelli=Number(fields.get("PZ")),peso=Number(fields.get("KG")),volume=Number(fields.get("MC"));if(!Number.isFinite(numeroPannelli)||!Number.isFinite(peso)||!Number.isFinite(volume))return null;return{codicePacco:fields.get("PK")!,commessa:fields.get("C")!,cliente:fields.get("CL")!,camion:fields.get("CA")!,numeroPannelli,peso,volume};}

