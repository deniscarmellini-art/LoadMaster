import { Box } from "@mui/material";
import { useLayoutEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Pannello } from "../../types/excel";
import { isDemoEnvironment } from "../../services/demoBranding";

export interface LabelFields { anno:string; commessa:string; cliente:string; riferimento:string; dtp:string; operatore:string; autMin:string; codiceEta:string; cpr:string; dataOra:string; rotate:boolean; }
interface Props { panel:Pannello; fields:LabelFields; index:number; }
const show = (v:string|number) => v === "" ? "—" : String(v);

export default function LabelPreview({ panel, fields, index }:Props) {
  const labelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Fit only text, never scale the physical label or its QR/marks.
    labelRef.current?.querySelectorAll<HTMLElement>(".label-fit").forEach(element => {
      element.style.fontSize = "";
      let size = parseFloat(getComputedStyle(element).fontSize);
      while (size > 8 && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    });
  }, [panel, fields, index]);
  const number = panel.numeroPannello.match(/\d+/)?.[0] ?? String(index + 1);
  const serial = `${fields.anno}-${fields.commessa}-${number.padStart(3,"0")}`;
  const qr = `C=${fields.commessa}|CL=${fields.cliente}|N=${panel.numeroPannello}|CA=${panel.numeroCamion}|S=${Math.round(panel.spessore)}|L=${Math.round(panel.lunghezza)}|H=${Math.round(panel.altezza)}|P=${Math.round(panel.peso)}`;
  return <Box ref={labelRef} className={`print-label${fields.rotate ? " print-label--rotated" : ""}`}>
    <Box className="label-brand">
      {isDemoEnvironment ? <Box className="label-logo label-demo-logo">SisLog DEMO</Box> : <img className="label-logo" src="/essepi-logo-print.png" alt="ESSEPI finestre & xlam" />}
      <Box className="label-qr"><QRCodeSVG value={qr} size={128} level="M" marginSize={1} /></Box>
    </Box>
    <Box className="label-main">
    <Box className="label-heading">
      <Box className="heading-panel"><small>Elemento</small><strong className="heading-value label-fit">{panel.numeroPannello}</strong><span className="label-fit">Master panel <b>{panel.numeroMasterPanel}</b></span></Box>
      <Box className="heading-order"><small>Commessa</small><strong className="heading-value label-fit">{fields.commessa}</strong></Box>
      <Box className="heading-truck"><small>Camion</small><strong className="heading-value label-fit">{show(panel.numeroCamion)}</strong></Box>
    </Box>
    <Box className="label-details">
      <Box className="label-field label-field-wide"><small>Matricola</small><b className="label-fit large">{serial}</b></Box>
      <Box className="label-field"><small>Tipologia</small><b className="label-fit">{show(panel.tipoPannello)}</b></Box>
      <Box className="label-field"><small>Qualità lato 1 / lato 2</small><b className="label-fit">{show(`${panel.lato1} / ${panel.lato2}`)}</b></Box>
      <Box className="label-field"><small>S × L × H (mm)</small><b className="label-fit">{Math.round(panel.spessore)} × {Math.round(panel.lunghezza)} × {Math.round(panel.altezza)}</b></Box>
      <Box className="label-field"><small>Peso</small><b className="label-fit large">{Math.round(panel.peso)} KG</b></Box>
      <Box className="label-field label-field-wide"><small>Cliente</small><b className="label-fit">{show(fields.cliente)}</b></Box>
      <Box className="label-field label-field-wide"><small>Rif. ordine</small><b className="label-fit">{show(fields.riferimento)}</b></Box>
    </Box>
    </Box>
    <Box className="label-codes">
      <Box className="heading-ce"><img className="heading-ce-mark" src="/ce-mark-official.png" alt="Marcatura CE" /><Box className="heading-certification"><small>C. TRAF. AUT_MIN</small><b className="label-fit">{fields.autMin}</b></Box><Box className="heading-certification"><small>CODICE ETA</small><b className="label-fit">{fields.codiceEta}</b></Box><Box className="heading-certification"><small>CODICE CPR</small><b className="label-fit">{fields.cpr}</b></Box></Box>
      <Box className="label-meta"><small>DTP</small><b className="label-fit">{show(fields.dtp)}</b></Box><Box className="label-meta"><small>Operatore</small><b className="label-fit">{show(fields.operatore)}</b></Box><Box className="label-meta"><small>Data / Ora</small><b className="label-fit">{show(fields.dataOra)}</b></Box>
    </Box>
    <Box className="preview-caption">Elemento {panel.numeroPannello} · {serial}</Box>
  </Box>;
}
