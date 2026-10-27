import { Button, Stack } from "@mui/material";

interface Props {
  documentId: string;
  busy: boolean;
  onView: () => void;
  onReturnToLoads?: () => void;
}

export default function IssuedDdtActions({ documentId, busy, onView, onReturnToLoads }: Props) {
  const pdfUrl = `/api/ddt/${encodeURIComponent(documentId)}/pdf`;
  if (onReturnToLoads) return <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
    <Button component="a" href={pdfUrl} target="_blank" rel="noopener">STAMPA DDT</Button>
    <Button variant="outlined" disabled={busy} onClick={onReturnToLoads}>TORNA A CARICO CAMION</Button>
  </Stack>;
  return <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
    <Button variant="outlined" disabled={busy} onClick={onView}>Visualizza / Ristampa DDT</Button>
    <Button component="a" href={pdfUrl} target="_blank" rel="noopener">Stampa DDT</Button>
    <Button component="a" href={`${pdfUrl}?download=1`}>Scarica/Salva PDF</Button>
  </Stack>;
}
