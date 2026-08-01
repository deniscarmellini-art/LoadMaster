import { useEffect, useRef } from "react";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { InputAdornment, TextField } from "@mui/material";

interface Props { disabled?:boolean; value:string; onValueChange:(value:string)=>void; onScan:(value:string)=>void; }
export default function ScannerInput({ disabled=false, value, onValueChange, onScan }:Props) {
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!disabled) inputRef.current?.focus();},[disabled]);
  const submit=()=>{if(!value.trim())return;onScan(value);requestAnimationFrame(()=>inputRef.current?.focus());};
  return <TextField autoFocus disabled={disabled} fullWidth inputRef={inputRef} label="Scanner QR pannello" placeholder="Scansiona il QR e premi Invio" value={value} onChange={e=>onValueChange(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();submit();}}} slotProps={{input:{startAdornment:<InputAdornment position="start"><QrCodeScannerIcon sx={{fontSize:34}}/></InputAdornment>}}} sx={{"& .MuiOutlinedInput-root":{fontSize:"1.15rem",minHeight:72},"& input":{fontFamily:"monospace"}}}/>;
}
