import { useEffect,useState } from "react";
import { Alert,Autocomplete,Box,TextField } from "@mui/material";
import { listCustomers,type Customer } from "../../services/customersApi";
export default function ShipmentCustomerPicker({value,onChange,customerName}:{value:string|null|undefined;onChange:(id:string|null)=>void;customerName:string}){
 const [items,setItems]=useState<Customer[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;listCustomers().then(rows=>{if(active)setItems(rows);}).catch(()=>{if(active)setError("Anagrafica clienti non disponibile. Il collegamento esistente resta conservato.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const selected=items.find(c=>c.id===value)??null;
 const key=(name:string)=>name.trim().replace(/\s+/gu," ").toLocaleLowerCase("it-IT");
 const matches=items.filter(c=>key(customerName)&&key(c.denominazione)===key(customerName));
 const automatic=!!import.meta.env.VITE_SISLOG_TEST&&!value&&!error&&!loading;
 return <Box sx={{gridColumn:"1 / -1",minWidth:0}}><Autocomplete size="small" options={items} value={selected} disabled={!!error} isOptionEqualToValue={(a,b)=>a.id===b.id} getOptionLabel={c=>[c.denominazione,c.partitaIva||c.codiceFiscale].filter(Boolean).join(" · ")} onChange={(_,customer)=>onChange(customer?.id??null)} noOptionsText="Nessun cliente: aggiungerlo in Anagrafiche → Clienti" renderInput={params=><TextField {...params} label="Collegamento anagrafica cliente (facoltativo, DDT)"/>}/>{error&&<Alert severity="warning" sx={{mt:1}}>{error}</Alert>}{automatic&&<Alert severity={matches.length===1?"info":"warning"} sx={{mt:1}}>{matches.length===1?`Al salvataggio verrà collegato automaticamente: ${matches[0]!.denominazione}. Puoi scegliere manualmente un altro cliente.`:matches.length>1?"Più clienti corrispondono esattamente al nome della commessa: seleziona esplicitamente quello corretto per il DDT.":"Nessuna corrispondenza esatta: seleziona esplicitamente il cliente anagrafico per il DDT."}</Alert>}</Box>;
}
