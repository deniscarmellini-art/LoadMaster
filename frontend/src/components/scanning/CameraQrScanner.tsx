import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useMediaQuery, useTheme } from "@mui/material";

interface Props {
  open: boolean;
  onDetected: (rawValue: string) => void;
  onClose: () => void;
}

const cameraErrorMessage = (error: unknown): string => {
  const namedError = typeof error === "object" && error !== null && "name" in error
    ? { name: String(error.name), message: "message" in error ? String(error.message) : "" }
    : null;
  if (namedError?.name === "NotAllowedError" || namedError?.name === "SecurityError") return "Accesso alla fotocamera negato. Abilita il permesso nelle impostazioni del browser.";
  if (namedError?.name === "NotFoundError" || namedError?.name === "OverconstrainedError") return "Nessuna fotocamera compatibile disponibile sul dispositivo.";
  if (namedError?.name === "NotReadableError" || namedError?.name === "AbortError") return "La fotocamera è occupata o non può essere avviata. Chiudi le altre applicazioni che la stanno usando.";
  const detail = namedError ? `${namedError.name}${namedError.message ? `: ${namedError.message}` : ""}` : String(error);
  return `Impossibile avviare la fotocamera (${detail}).`;
};

export default function CameraQrScanner({ open, onDetected, onClose }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    detectedRef.current = false;
    setError(null);
    if (!window.isSecureContext) {
      setError("La fotocamera richiede una connessione HTTPS. La scansione con lettore fisico rimane disponibile.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Questo browser non supporta l’accesso alla fotocamera. Usa un browser aggiornato o il lettore QR fisico.");
      return;
    }

    let cancelled = false;
    const start = async () => {
      try {
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error("Elemento video non disponibile");
        }
        video.srcObject = stream;
        await video.play();
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 500 });
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _scanError, scanControls) => {
            if (!result || cancelled || detectedRef.current) return;
            detectedRef.current = true;
            scanControls.stop();
            stopCamera();
            onDetected(result.getText());
          },
        );
        if (cancelled || detectedRef.current) controls.stop();
        else controlsRef.current = controls;
      } catch (startError) {
        if (!cancelled) {
          console.error("Errore avvio fotocamera QR", startError);
          setError(cameraErrorMessage(startError));
        }
        stopCamera();
      }
    };
    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onDetected, open, stopCamera]);

  const cancel = () => {
    stopCamera();
    onClose();
  };

  return <Dialog open={open} onClose={cancel} fullScreen={fullScreen} fullWidth maxWidth="sm" slotProps={{paper:{sx:{overflow:"hidden"}}}}>
    <DialogTitle>Scansiona QR con fotocamera</DialogTitle>
    <DialogContent sx={{display:"flex",flexDirection:"column",gap:1.5,p:{xs:1.5,sm:2}}}>
      {error ? <Alert severity="error">{error}</Alert> : <>
        <Box sx={{position:"relative",width:"100%",height:{xs:"62vh",sm:480},minHeight:{xs:320,sm:480},maxHeight:{xs:620,sm:480},overflow:"hidden",borderRadius:2,bgcolor:"#000"}}>
          <Box component="video" ref={videoRef} muted playsInline autoPlay sx={{width:"100%",height:"100%",display:"block",objectFit:"cover",transform:"translateZ(0)"}}/>
          <Box aria-hidden sx={{position:"absolute",inset:"18% 10%",border:"3px solid",borderColor:"primary.main",borderRadius:2,boxShadow:"0 0 0 999px rgba(0,0,0,.28)"}}/>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{textAlign:"center"}}>Inquadra il QR all’interno del riquadro.</Typography>
      </>}
    </DialogContent>
    <DialogActions sx={{position:"sticky",bottom:0,bgcolor:"background.paper",p:2}}><Button variant="outlined" onClick={cancel}>Annulla</Button></DialogActions>
  </Dialog>;
}
