import { Box } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import type { Pannello } from "../../types/excel";

export interface LabelFields { anno:string; commessa:string; cliente:string; riferimento:string; tipologia:string; dtp:string; operatore:string; autMin:string; codiceEta:string; dataOra:string; rotate:boolean; }
interface Props { panel:Pannello; fields:LabelFields; index:number; }
const show = (v:string|number) => v === "" ? "—" : String(v);

export default function LabelPreview({ panel, fields, index }:Props) {
  const number = panel.numeroPannello.match(/\d+/)?.[0] ?? String(index + 1);
  const serial = `${fields.anno}-${fields.commessa}-${number.padStart(3,"0")}`;
  const qr = `C=${fields.commessa}|CL=${fields.cliente}|N=${panel.numeroPannello}|CA=${panel.numeroCamion}|S=${panel.spessore}|L=${panel.lunghezza}|H=${panel.altezza}|P=${panel.peso}`;
  return <Box className={`print-label${fields.rotate ? " print-label--rotated" : ""}`}>
    <Box className="label-brand"><Box className="label-logo"><b>essepi</b><small>finestre &amp; xlam</small></Box></Box>
    <Box className="label-heading">
      <Box className="heading-panel"><small>Pannello</small><strong className="heading-value">{panel.numeroPannello}</strong><span>Master panel <b>{panel.numeroMasterPanel}</b></span></Box>
      <Box className="heading-order"><small>Commessa</small><strong className="heading-value">{fields.commessa}</strong></Box>
      <Box className="heading-truck"><small>Camion</small><strong className="heading-value">{show(panel.numeroCamion)}</strong></Box>
      <Box className="heading-ce"><strong>CE</strong><b>{fields.autMin}</b><small>C. TRASF. Aut-Min.</small><b>{fields.codiceEta}</b><small>Codice ETA</small></Box>
    </Box>
    <Box className="label-details">
      <span>Matricola</span><b className="large">{serial}</b><span>Tipologia</span><b>{show(fields.tipologia || panel.tipoPannello)}</b>
      <span>Qualità lato 1 / lato 2</span><b>{show(`${panel.lato1} / ${panel.lato2}`)}</b><span>S × L × H (mm)</span><b>{Math.round(panel.spessore)} × {Math.round(panel.lunghezza)} × {Math.round(panel.altezza)}</b>
      <span>Peso</span><b className="large">{Math.round(panel.peso)} KG</b><span>Cliente</span><b>{show(fields.cliente)}</b><span>Rif. ordine</span><b>{show(fields.riferimento)}</b>
    </Box>
    <Box className="label-codes"><QRCodeSVG value={qr} size={128} level="M" marginSize={1} />
      <Box><small>DTP</small><b>{show(fields.dtp)}</b></Box><Box><small>Operatore</small><b>{show(fields.operatore)}</b></Box><Box><small>Data / Ora</small><b>{show(fields.dataOra)}</b></Box>
    </Box>
    <Box className="preview-caption">Pannello {panel.numeroPannello} · {serial}</Box>
  </Box>;
}
