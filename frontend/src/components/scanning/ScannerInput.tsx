import { useCallback, useEffect, useRef, useState } from "react";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { Button, InputAdornment, Stack, TextField, useMediaQuery, useTheme } from "@mui/material";
import CameraQrScanner from "./CameraQrScanner";

interface Props { disabled?:boolean; mobileEmphasis?:boolean; value:string; onValueChange:(value:string)=>void; onScan:(value:string)=>void; }
export default function ScannerInput({ disabled=false, mobileEmphasis=false, value, onValueChange, onScan }:Props) {
  const theme=useTheme();
  const narrowPhone=useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone=useMediaQuery("(max-width:950px) and (max-height:500px)");
  const smartphone=narrowPhone||landscapePhone;
  const inputRef=useRef<HTMLInputElement>(null);
  const onScanRef=useRef(onScan);
  const [cameraOpen,setCameraOpen]=useState(false);
  useEffect(()=>{onScanRef.current=onScan;},[onScan]);
  useEffect(()=>{if(!disabled&&!smartphone) inputRef.current?.focus();},[disabled,smartphone]);
  const submit=()=>{if(!value.trim())return;onScan(value);requestAnimationFrame(()=>inputRef.current?.focus());};
  const restoreFocus=useCallback(()=>{if(!smartphone)requestAnimationFrame(()=>inputRef.current?.focus());},[smartphone]);
  const closeCamera=useCallback(()=>{setCameraOpen(false);restoreFocus();},[restoreFocus]);
  const cameraDetected=useCallback((rawValue:string)=>{setCameraOpen(false);onScanRef.current(rawValue);restoreFocus();},[restoreFocus]);
  return <>
    <Stack direction={{xs:"column",sm:"row"}} sx={{gap:1.5,alignItems:"stretch"}}>
      {!smartphone && (
        <TextField autoFocus disabled={disabled} fullWidth inputRef={inputRef} label="Scanner QR pannello" placeholder="Scansiona il QR e premi Invio" value={value} onChange={e=>onValueChange(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();submit();}}} slotProps={{input:{startAdornment:<InputAdornment position="start"><QrCodeScannerIcon sx={{fontSize:34}}/></InputAdornment>}}} sx={{order:{xs:mobileEmphasis?2:1,sm:1},"& .MuiOutlinedInput-root":{fontSize:"1.15rem",minHeight:{xs:mobileEmphasis?56:72,sm:72}},"& input":{fontFamily:"monospace"}}}/>
      )}
      <Button fullWidth={smartphone} disabled={disabled||cameraOpen} variant={smartphone||mobileEmphasis?"contained":"outlined"} size="large" startIcon={<PhotoCameraOutlinedIcon/>} onClick={()=>setCameraOpen(true)} sx={{order:{xs:mobileEmphasis?1:2,sm:2},minWidth:{sm:230},minHeight:{xs:64,sm:72},fontSize:{xs:"1rem"},whiteSpace:"nowrap"}}>Scansiona con fotocamera</Button>
    </Stack>
    <CameraQrScanner open={cameraOpen} onDetected={cameraDetected} onClose={closeCamera}/>
  </>;
}
