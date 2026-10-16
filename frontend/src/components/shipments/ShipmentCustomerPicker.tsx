import { useEffect,useState } from "react";
import { Alert,Autocomplete,Box,TextField } from "@mui/material";
import { listCustomers,type Customer } from "../../services/customersApi";
export default function ShipmentCustomerPicker({value,onChange}:{value:string|null|undefined;onChange:(id:string|null)=>void}){
 const [items,setItems]=useState<Customer[]>([]),[error,setError]=useState("");
 useEffect(()=>{let active=true;listCustomers().then(rows=>{if(active)setItems(rows);}).catch(()=>{if(active)setError("Anagrafica clienti non disponibile. Il collegamento esistente resta conservato.");});return()=>{active=false;};},[]);
 const selected=items.find(c=>c.id===value)??null;
 return <Box sx={{gridColumn:"1 / -1",minWidth:0}}><Autocomplete size="small" options={items} value={selected} disabled={!!error} isOptionEqualToValue={(a,b)=>a.id===b.id} getOptionLabel={c=>[c.denominazione,c.partitaIva||c.codiceFiscale].filter(Boolean).join(" · ")} onChange={(_,customer)=>onChange(customer?.id??null)} noOptionsText="Nessun cliente: aggiungerlo in Anagrafiche → Clienti" renderInput={params=><TextField {...params} label="Collegamento anagrafica cliente (facoltativo, DDT)"/>}/>{error&&<Alert severity="warning" sx={{mt:1}}>{error}</Alert>}</Box>;
}
