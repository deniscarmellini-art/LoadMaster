import { Box, Paper, Typography } from "@mui/material";

export interface OperationalIdentityRow { customer:string; orderReference:string; order:string; truck:string }

export function OperationalIdentity({ rows, label, fullWidth=false }: {rows:OperationalIdentityRow[];label:string;fullWidth?:boolean}) {
  return <Box aria-label={label} sx={{flex:1,minWidth:0,width:"100%",maxWidth:fullWidth?"none":1240,mx:"auto"}}>
    {rows.map((row,index)=><Box key={index} sx={{display:"grid",gridTemplateColumns:{xs:"repeat(2,minmax(0,1fr))",md:fullWidth?"minmax(0,1.7fr) minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr)":"minmax(0,320px) minmax(0,300px) minmax(0,180px) minmax(0,180px)"},justifyContent:"center",columnGap:1.5,rowGap:1,alignItems:"start",mt:index?1.5:0}}>
      {[["CLIENTE",row.customer],["RIFERIMENTO ORDINE",row.orderReference],["COMMESSA",row.order],["CAMION",row.truck]].map(([name,value])=><Box key={name} sx={{minWidth:0}}>
        <Typography variant="caption" color="text.secondary" sx={{fontWeight:700,fontSize:{xs:13,md:14}}}>{name}</Typography>
        <Typography sx={{fontWeight:800,fontSize:{xs:20,md:22,lg:24},overflowWrap:"anywhere"}}>{value}</Typography>
      </Box>)}
    </Box>)}
  </Box>;
}

export function OperationalKpis({ fields, label }: {fields:ReadonlyArray<readonly [string,string|number]>;label:string}) {
  return <Box aria-label={label} sx={{display:"grid",gridTemplateColumns:{xs:"repeat(2,minmax(0,1fr))",sm:"repeat(4,minmax(0,1fr))",lg:`repeat(${fields.length},minmax(0,1fr))`},gridAutoRows:"1fr",gap:1,mb:2}}>
    {fields.map(([name,value])=><Paper key={name} variant="outlined" sx={{p:1.5,minWidth:0,minHeight:94,textAlign:"center",display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <Typography variant="caption" color="text.secondary" sx={{lineHeight:1.4}}>{name}</Typography>
      <Typography sx={{fontWeight:800,fontSize:24,lineHeight:1.4,overflowWrap:"anywhere"}}>{value}</Typography>
    </Paper>)}
  </Box>;
}

export const operationalSectionSx = {p:{xs:1.5,sm:2},mb:2,border:1,borderColor:"divider",minWidth:0};
export const operationalTableSx = {minWidth:0,overflowX:"auto"};
export const operationalTransportRowSx = {
  display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"repeat(3,minmax(0,1fr))",md:"minmax(0,1.05fr) minmax(0,1.05fr) minmax(0,1fr) minmax(190px,1.35fr) 172px"},
  alignItems:"start",gap:1.5,"& > *":{minWidth:0},
  "& .MuiOutlinedInput-root":{height:56},
  "& .MuiInputLabel-root":{fontSize:14},
  "& .MuiInputBase-input":{fontSize:14},
  "& > .MuiButton-root":{height:56,minHeight:56,whiteSpace:"nowrap"},
};
export const operationalScannerSx = {...operationalSectionSx,
  "& .MuiTextField-root .MuiOutlinedInput-root":{minHeight:58,height:58},
  "& > .MuiStack-root > .MuiButton-root":{minHeight:{xs:64,sm:58},height:{sm:58},width:{sm:240},minWidth:{sm:240},fontSize:"1rem",fontWeight:500},
};
