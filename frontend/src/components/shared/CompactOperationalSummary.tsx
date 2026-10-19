import { Box, Paper, Typography } from "@mui/material";

/** Presentation only: callers supply the existing identity and KPI values. */
export default function CompactOperationalSummary({fields,label,loading=false}:{fields:ReadonlyArray<readonly [string,string|number]>;label:string;loading?:boolean}) {
  const singleRow=loading?"xl":"lg";
  const columns=loading
    ? "minmax(180px,2fr) minmax(90px,.75fr) minmax(180px,2fr) minmax(64px,.55fr) repeat(4,minmax(76px,.65fr)) minmax(145px,1.15fr) minmax(150px,1.15fr) minmax(95px,.8fr)"
    : "minmax(0,2.2fr) minmax(88px,.8fr) minmax(0,2.2fr) minmax(64px,.6fr) repeat(4,minmax(84px,.8fr))";
  return <Box aria-label={label} sx={{display:"grid",gridTemplateColumns:{xs:"repeat(4,minmax(0,1fr))",sm:`repeat(${loading?14:12},minmax(0,1fr))`,[singleRow]:columns},gap:.75,gridAutoRows:"1fr",alignItems:"stretch"}}>
    {fields.map(([name,value],index)=><Paper key={name} variant="outlined" sx={{gridColumn:{xs:"auto",sm:`span ${index>=4?(loading?2:3):index===0||index===2?(loading?5:4):2}`,[singleRow]:"auto"},minWidth:0,minHeight:88,p:1,display:"flex",flexDirection:"column",justifyContent:"center",textAlign:index<4?"left":"center"}}>
      <Typography variant="caption" color="text.secondary" sx={{fontSize:12,fontWeight:700,lineHeight:1.4,overflowWrap:"anywhere"}}>{name}</Typography>
      <Typography sx={{fontSize:{xs:18,sm:24,lg:28},fontWeight:800,lineHeight:1.35,overflowWrap:"anywhere",whiteSpace:"pre-line",fontVariantNumeric:"tabular-nums"}}>{value}</Typography>
    </Paper>)}
  </Box>;
}
