import { useState } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditDocumentIcon from "@mui/icons-material/EditDocument";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import type { Camion } from "../../models/Camion";
import type { ShipmentItem } from "../../services/shipmentsApi";
import { dashboardColors } from "../../theme/theme";
import PlannedDepartureDate from "../shipments/PlannedDepartureDate";
import { runDashboardPrimaryAction } from "./dashboardPrimaryAction";
import type { DashboardTransportPresentation } from "./dashboardTransport";

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
  shipmentFor: (row: Camion) => ShipmentItem | undefined;
  transportFor: (row: Camion) => DashboardTransportPresentation;
}

export default function DashboardGrid({ rows, onDelete, onOpenScanning, onStartLoad, onPrintPackages, hasPackages, onUpdate, onReopen, onContinueLoad, onConfirmDeparture, onOpenHistory, shipmentFor, transportFor }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [menuRow, setMenuRow] = useState<Camion | null>(null);
  const closeMenu = () => { setAnchorEl(null); setMenuRow(null); };
  const runAction = (action: () => void) => { closeMenu(); action(); };
  const primaryHandlers = { onConfirmDeparture, onContinueLoad, onOpenHistory, onOpenScanning, onStartLoad };
  const fixedColumn = { disableReorder: true } as const;
  const columns: GridColDef<Camion>[] = [
    { ...fixedColumn, field: "commessa", headerName: "Commessa", width: 140, align: "left", headerAlign: "left" },
    { ...fixedColumn, field: "cliente", headerName: "Cliente", width: 200, align: "left", headerAlign: "left" },
    { ...fixedColumn, field: "camion", headerName: "Camion", width: 100, align: "center", headerAlign: "center" },
    { ...fixedColumn, field: "previsti", headerName: "Previsti", width: 100, type: "number", align: "center", headerAlign: "center" },
    { ...fixedColumn, field: "pronti", headerName: "Pronti", width: 100, type: "number", align: "center", headerAlign: "center" },
    { ...fixedColumn, field: "caricati", headerName: "Caricati", width: 105, type: "number", align: "center", headerAlign: "center" },
    {
      ...fixedColumn,
      field: "peso",
      headerName: "Peso",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
      valueFormatter: (value) => `${Number(value).toLocaleString("it-IT", { maximumFractionDigits: 1 })} kg`,
    },
    {
      ...fixedColumn,
      field: "volume",
      headerName: "Volume",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
      valueFormatter: (value) => `${Number(value).toLocaleString("it-IT", { maximumFractionDigits: 2 })} m³`,
    },
    {
      ...fixedColumn,
      field: "stato",
      headerName: "Stato",
      width: 250,
      align: "center",
      headerAlign: "center",
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
            sx={{ fontWeight: 700, height: 30, minWidth: 142, "& .MuiChip-label": { px: 1.25, textAlign: "center", width: "100%" } }}
          />
        );
      },
    },
    {
      ...fixedColumn,
      field: "plannedDepartureDate",
      headerName: "Partenza prevista",
      width: 170,
      type: "date",
      align: "center",
      headerAlign: "center",
      valueGetter: (_value, row) => {
        const value = shipmentFor(row)?.plannedDepartureDate;
        return value ? new Date(`${value}T00:00:00`) : null;
      },
      renderCell: (params) => {
        const shipment = shipmentFor(params.row);
        return shipment ? <PlannedDepartureDate shipment={shipment} /> : "—";
      },
    },
    {
      ...fixedColumn,
      field: "transport",
      headerName: "Trasporto",
      width: 230,
      align: "center",
      headerAlign: "center",
      valueGetter: (_value, row) => transportFor(row).label,
      renderCell: (params) => (
        <Typography noWrap variant="body2" title={transportFor(params.row).label}>
          {transportFor(params.row).label}
        </Typography>
      ),
    },
    {
      ...fixedColumn,
      field: "operazione",
      headerName: "Operazioni",
      width: 95,
      sortable: false,
      filterable: false,
      align: "center",
      headerAlign: "center",
      headerClassName: "dashboard-grid__operations-header",
      renderCell: (params) => {
        return <IconButton aria-label={`Operazioni commessa ${params.row.commessa}`} onClick={(event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); setMenuRow(params.row); }} size="small" sx={{ borderRadius: 1.5, height: 32, width: 32, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}><MoreVertIcon fontSize="small" /></IconButton>;
      },
    },
  ];

  return (
    <>
    <DataGrid
      columns={columns}
      disableColumnFilter
      disableColumnMenu
      disableColumnResize
      disableColumnSelector
      onRowDoubleClick={(params) => runDashboardPrimaryAction(params.row, primaryHandlers)}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[10, 25, 50]}
      rowHeight={56}
      rows={rows}
      sortingOrder={["asc", "desc"]}
      sx={{
        bgcolor: dashboardColors.grid,
        border: 0,
        borderRadius: 2,
        "& .MuiDataGrid-columnHeaders": { backgroundColor: dashboardColors.header, borderBottom: "1px solid rgba(255,255,255,0.16)" },
        "& .MuiDataGrid-columnHeader": { px: 2, transition: "background-color 180ms ease, color 180ms ease" },
        "& .MuiDataGrid-columnSeparator": { display: "none" },
        "& .dashboard-grid__operations-header": { px: 1 },
        "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 800, letterSpacing: 0.2 },
        "& .MuiDataGrid-cell": { borderColor: "rgba(255,255,255,0.07)", px: 2, transition: "background-color 180ms ease, color 180ms ease" },
        "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": { outline: "none" },
        "& .MuiDataGrid-row": { cursor: "pointer", transition: "background-color 180ms ease, color 180ms ease" },
        "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: dashboardColors.stripe },
        "& .MuiDataGrid-row:hover": { backgroundColor: dashboardColors.rowHover },
        "& .MuiDataGrid-row.Mui-selected": { backgroundColor: dashboardColors.rowSelected },
        "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: dashboardColors.rowSelectedHover },
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
