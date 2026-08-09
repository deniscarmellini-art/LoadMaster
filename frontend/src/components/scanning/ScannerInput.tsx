import { useEffect, useRef, useState } from "react";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { Button, InputAdornment, Stack, TextField } from "@mui/material";
import CameraQrScanner from "./CameraQrScanner";

interface Props { disabled?:boolean; value:string; onValueChange:(value:string)=>void; onScan:(value:string)=>void; }
export default function ScannerInput({ disabled=false, value, onValueChange, onScan }:Props) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [cameraOpen,setCameraOpen]=useState(false);
  useEffect(()=>{if(!disabled) inputRef.current?.focus();},[disabled]);
  const submit=()=>{if(!value.trim())return;onScan(value);requestAnimationFrame(()=>inputRef.current?.focus());};
  const restoreFocus=()=>requestAnimationFrame(()=>inputRef.current?.focus());
  const closeCamera=()=>{setCameraOpen(false);restoreFocus();};
  const cameraDetected=(rawValue:string)=>{setCameraOpen(false);onScan(rawValue);restoreFocus();};
  return <>
    <Stack direction={{xs:"column",sm:"row"}} sx={{gap:1.5,alignItems:"stretch"}}>
      <TextField autoFocus disabled={disabled} fullWidth inputRef={inputRef} label="Scanner QR pannello" placeholder="Scansiona il QR e premi Invio" value={value} onChange={e=>onValueChange(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();submit();}}} slotProps={{input:{startAdornment:<InputAdornment position="start"><QrCodeScannerIcon sx={{fontSize:34}}/></InputAdornment>}}} sx={{"& .MuiOutlinedInput-root":{fontSize:"1.15rem",minHeight:72},"& input":{fontFamily:"monospace"}}}/>
      <Button disabled={disabled} variant="outlined" size="large" startIcon={<PhotoCameraOutlinedIcon/>} onClick={()=>setCameraOpen(true)} sx={{minWidth:{sm:230},minHeight:{xs:52,sm:72},whiteSpace:"nowrap"}}>Scansiona con fotocamera</Button>
    </Stack>
    <CameraQrScanner open={cameraOpen} onDetected={cameraDetected} onClose={closeCamera}/>
  </>;
}
