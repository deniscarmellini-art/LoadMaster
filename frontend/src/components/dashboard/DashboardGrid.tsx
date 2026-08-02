import { useState } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditDocumentIcon from "@mui/icons-material/EditDocument";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import type { Camion } from "../../models/Camion";

interface Props {
  rows: Camion[];
  onDelete: (row: Camion) => void;
  onOpenScanning: (row: Camion) => void;
  onStartLoad: (row: Camion) => void;
  onPrintPackages: (row: Camion) => void;
  hasPackages: (row: Camion) => boolean;
  onUpdate: () => void;
  onReopen: (row: Camion) => void;
  onContinueLoad: (row: Camion) => void;
  onConfirmDeparture: (row: Camion) => void;
  onOpenHistory: (row: Camion) => void;
}

export default function DashboardGrid({ rows, onDelete, onOpenScanning, onStartLoad, onPrintPackages, hasPackages, onUpdate, onReopen, onContinueLoad, onConfirmDeparture, onOpenHistory }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [menuRow, setMenuRow] = useState<Camion | null>(null);
  const closeMenu = () => { setAnchorEl(null); setMenuRow(null); };
  const runAction = (action: () => void) => { closeMenu(); action(); };
  const runPrimaryAction = (row: Camion) => {
    if (row.stato === "Da completare") onOpenScanning(row);
    else if (row.stato === "Da caricare") onStartLoad(row);
    else if (row.stato === "In carico") onContinueLoad(row);
    else if (row.stato === "Attesa spedizione") onConfirmDeparture(row);
    else if (row.stato === "Partita") onOpenHistory(row);
  };
  const columns: GridColDef<Camion>[] = [
    { field: "commessa", headerName: "Commessa", minWidth: 120 },
    { field: "cliente", headerName: "Cliente", flex: 1, minWidth: 180 },
    { field: "camion", headerName: "Camion", minWidth: 100 },
    { field: "previsti", headerName: "Previsti", minWidth: 90, type: "number" },
    { field: "pronti", headerName: "Pronti", minWidth: 90, type: "number" },
    { field: "caricati", headerName: "Caricati", minWidth: 95, type: "number" },
    {
      field: "peso",
      headerName: "Peso",
      minWidth: 110,
      type: "number",
      valueFormatter: (value) => `${Number(value).toLocaleString("it-IT", { maximumFractionDigits: 1 })} kg`,
    },
    {
      field: "volume",
      headerName: "Volume",
      minWidth: 110,
      type: "number",
      valueFormatter: (value) => `${Number(value).toLocaleString("it-IT", { maximumFractionDigits: 2 })} m³`,
    },
    {
      field: "stato",
      headerName: "Stato",
      flex: 1,
      minWidth: 170,
      renderCell: (params) => {
        const stato = params.value;
        const color = stato === "In carico"
          ? "warning"
          : stato === "Attesa spedizione" || stato === "Partita"
            ? "success"
            : stato === "Da caricare"
              ? "info"
              : "error";
        return (
          <Chip
            color={color}
            label={stato}
            size="small"
            variant="outlined"
            sx={stato === "Da completare" ? { fontWeight: 700, height: 30, "& .MuiChip-label": { px: 1.25 } } : undefined}
          />
        );
      },
    },
    {
      field: "operazione",
      headerName: "Operazioni",
      minWidth: 110,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        return <IconButton aria-label={`Operazioni commessa ${params.row.commessa}`} onClick={(event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); setMenuRow(params.row); }} size="small"><MoreVertIcon /></IconButton>;
      },
    },
  ];

  return (
    <>
    <DataGrid
      columns={columns}
      onRowDoubleClick={(params) => runPrimaryAction(params.row)}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[10, 25, 50]}
      rows={rows}
      sx={{
        bgcolor: "#10161e",
        border: 0,
        borderRadius: 2,
        "& .MuiDataGrid-columnHeaders": { backgroundColor: "#1d2733", borderBottom: "1px solid rgba(255,255,255,0.14)" },
        "& .MuiDataGrid-columnHeader": { px: 2 },
        "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 800, letterSpacing: 0.2 },
        "& .MuiDataGrid-cell": { borderColor: "rgba(255,255,255,0.07)", px: 2 },
        "& .MuiDataGrid-row": { cursor: "pointer" },
        "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(255,255,255,0.07)" },
        "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "rgba(25,118,210,0.2)" },
        "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "rgba(25,118,210,0.28)" },
      }}
    />
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
      {menuRow?.stato==="In carico"&&<MenuItem onClick={()=>{const row=menuRow;closeMenu();onContinueLoad(row);}}><ListItemIcon><LaunchOutlinedIcon fontSize="small"/></ListItemIcon><ListItemText>Continua carico</ListItemText></MenuItem>}
      <MenuItem onClick={() => runAction(onUpdate)}><ListItemIcon><EditDocumentIcon fontSize="small" /></ListItemIcon><ListItemText>Aggiorna distinta</ListItemText></MenuItem>
      {menuRow&&hasPackages(menuRow)&&<MenuItem onClick={()=>runAction(()=>onPrintPackages(menuRow))}><ListItemIcon><PrintOutlinedIcon fontSize="small"/></ListItemIcon><ListItemText>Stampa etichette pacchi</ListItemText></MenuItem>}
      {menuRow?.stato==="Attesa spedizione"&&<MenuItem onClick={()=>menuRow&&runAction(()=>onReopen(menuRow))}><ListItemIcon><EditDocumentIcon fontSize="small"/></ListItemIcon><ListItemText>Riapri carico</ListItemText></MenuItem>}
      {menuRow?.stato!=="Attesa spedizione"&&<MenuItem sx={{color:"error.main"}} onClick={()=>menuRow&&runAction(()=>onDelete(menuRow))}><ListItemIcon><DeleteOutlinedIcon color="error" fontSize="small"/></ListItemIcon><ListItemText>Elimina</ListItemText></MenuItem>}
    </Menu>
    </>
  );
}
