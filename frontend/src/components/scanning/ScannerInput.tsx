import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { Box, Button, InputAdornment, Stack, TextField, useMediaQuery, useTheme } from "@mui/material";
import CameraQrScanner from "./CameraQrScanner";

interface Props { betweenControls?:ReactNode; managedFocus?:boolean; onRestoreFocus?:()=>void; disabled?:boolean; inputRef?:RefObject<HTMLInputElement|null>; mobileEmphasis?:boolean; value:string; onValueChange:(value:string)=>void; onScan:(value:string)=>void; }
export default function ScannerInput({ betweenControls, managedFocus=false, onRestoreFocus, disabled=false, inputRef:externalInputRef, mobileEmphasis=false, value, onValueChange, onScan }:Props) {
  const theme=useTheme();
  const narrowPhone=useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone=useMediaQuery("(max-width:950px) and (max-height:500px)");
  const smartphone=narrowPhone||landscapePhone;
  const localInputRef=useRef<HTMLInputElement>(null);
  const inputRef=externalInputRef??localInputRef;
  const onScanRef=useRef(onScan);
  const [cameraOpen,setCameraOpen]=useState(false);
  useEffect(()=>{onScanRef.current=onScan;},[onScan]);
  const restoreFocus=useCallback(()=>{if(managedFocus){onRestoreFocus?.();return;}if(disabled||smartphone||cameraOpen)return;requestAnimationFrame(()=>{if(!document.querySelector('[role="dialog"]'))inputRef.current?.focus();});},[managedFocus,onRestoreFocus,cameraOpen,disabled,smartphone,inputRef]);
  useEffect(()=>{if(!managedFocus&&!disabled&&!smartphone)requestAnimationFrame(()=>inputRef.current?.focus());},[managedFocus,disabled,smartphone,inputRef]);
  const submit=()=>{if(!value.trim())return;onScan(value);};
  const closeCamera=useCallback(()=>{setCameraOpen(false);restoreFocus();},[restoreFocus]);
  const cameraDetected=useCallback((rawValue:string)=>{
    setCameraOpen(false);
    onScanRef.current(rawValue);
    // With managed focus, the owner restores focus only after the async scan finishes.
    if(!managedFocus)restoreFocus();
  },[managedFocus,restoreFocus]);
  return <>
    <Stack direction={{xs:"column",sm:"row"}} sx={{gap:1.5,alignItems:betweenControls?{xs:"stretch",sm:"center"}:"stretch",...(betweenControls?{flexWrap:"wrap","& .MuiButton-root":{height:58,minHeight:58,fontSize:"1rem",fontWeight:500,px:2,whiteSpace:"nowrap"},"& .MuiButton-startIcon > svg":{fontSize:24}}:{})}}>
      {!smartphone && (
        <TextField autoFocus={!managedFocus} disabled={disabled} fullWidth inputRef={inputRef} label="Scanner QR elemento" placeholder="Scansiona il QR e premi Invio" value={value} onChange={e=>onValueChange(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();submit();}}} slotProps={{input:{startAdornment:<InputAdornment position="start"><QrCodeScannerIcon sx={{fontSize:34}}/></InputAdornment>}}} sx={{...(betweenControls?{flex:{sm:"1 1 240px"},minWidth:{xs:0,sm:240}}:{}),order:{xs:mobileEmphasis?2:1,sm:1},"& .MuiOutlinedInput-root":{fontSize:"1.15rem",...(betweenControls?{height:58,minHeight:58}:{minHeight:{xs:mobileEmphasis?56:72,sm:72}})},"& input":{fontFamily:"monospace"}}}/>
      )}
      {betweenControls&&<Box sx={{order:2,flexShrink:0,width:{xs:"100%",sm:190},"& > .MuiButton-root":{width:"100%"}}}>{betweenControls}</Box>}
      <Button fullWidth={smartphone} disabled={disabled||cameraOpen} variant={smartphone||mobileEmphasis?"contained":"outlined"} size="large" startIcon={<PhotoCameraOutlinedIcon/>} onClick={()=>setCameraOpen(true)} sx={{...(betweenControls?{flexShrink:0,width:{xs:"100%",sm:240}}:{}),order:{xs:betweenControls?3:mobileEmphasis?1:2,sm:betweenControls?3:2},minWidth:{sm:betweenControls?240:230},minHeight:betweenControls?58:{xs:64,sm:72},fontSize:{xs:"1rem"},whiteSpace:"nowrap"}}>Scansiona con fotocamera</Button>
    </Stack>
    <CameraQrScanner open={cameraOpen} onDetected={cameraDetected} onClose={closeCamera}/>
  </>;
}
