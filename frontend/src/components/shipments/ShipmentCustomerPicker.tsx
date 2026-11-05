import { useEffect,useState } from "react";
import { Alert,Autocomplete,Box,Button,TextField } from "@mui/material";
import { listCustomers,type Customer } from "../../services/customersApi";
import { proposeCustomer,searchCustomers,customerNameKey } from "../../services/customerNameMatching";
export default function ShipmentCustomerPicker({value,onChange,customerName,readOnly=false}:{value:string|null|undefined;onChange:(id:string|null)=>void;customerName:string;readOnly?:boolean}){
 const [items,setItems]=useState<Customer[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;listCustomers().then(rows=>{if(active)setItems(rows);}).catch(()=>{if(active)setError("Anagrafica clienti non disponibile. Il collegamento esistente resta conservato.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const selected=items.find(c=>c.id===value)??null;
 const automatic=!readOnly&&!value&&!error&&!loading;
  const proposal=proposeCustomer(items,customerName);
  const matches=customerNameKey(customerName)?searchCustomers(items,customerName):[];
  return <Box sx={{gridColumn:"1 / -1",minWidth:0}}>
   <Autocomplete size="small" options={items} value={selected} loading={loading} disabled={readOnly||!!error||loading}
    openOnFocus filterOptions={(options,state)=>searchCustomers(options,state.inputValue)}
    isOptionEqualToValue={(a,b)=>a.id===b.id}
    getOptionLabel={c=>[c.denominazione,c.partitaIva||c.codiceFiscale].filter(Boolean).join(" · ")}
    onChange={(_,customer)=>onChange(customer?.id??null)}
    noOptionsText="Nessuna corrispondenza: prova un altro nome o una partita IVA"
    renderInput={params=><TextField {...params} label="Collegamento anagrafica cliente (facoltativo, DDT)" helperText={selected?"Cliente selezionato: il collegamento verrà conservato al salvataggio della pianificazione.":"Cerca per nome, anche parziale, partita IVA o codice fiscale. Selezionare un risultato conferma la scelta."}/>}/>
   {error&&<Alert severity="warning" sx={{mt:1}}>{error}</Alert>}
   {automatic&&<Alert severity={proposal?"info":"warning"} sx={{mt:1}}>
    {proposal?<Box sx={{display:"flex",gap:1,alignItems:"center",flexWrap:"wrap"}}>
     <span>Cliente proposto: <strong>{proposal.denominazione}</strong>. Il collegamento richiede conferma.</span>
     <Button size="small" variant="outlined" onClick={()=>onChange(proposal.id)}>Conferma collegamento</Button>
    </Box>:matches.length>1?`Più clienti simili: ${matches.map(c=>c.denominazione).join("; ")}. Seleziona esplicitamente quello corretto.`:"Nessuna corrispondenza affidabile: cerca e seleziona il cliente anagrafico per il DDT."}
   </Alert>}
  </Box>;
}
