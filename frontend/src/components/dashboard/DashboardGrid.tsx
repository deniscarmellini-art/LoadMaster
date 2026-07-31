import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Button, Chip, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import type { Camion } from "../../models/Camion";

interface Props {
  rows: Camion[];
}

export default function DashboardGrid({ rows }: Props) {
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
        const label = stato === "In carico"
          ? "In carico"
          : stato === "Attesa ritiro"
            ? "Attesa spedizione"
            : params.row.previsti === params.row.pronti
              ? "Da caricare"
              : "Non completa";
        const color = stato === "In carico"
          ? "warning"
          : stato === "Attesa ritiro"
            ? "success"
            : params.row.previsti === params.row.pronti
              ? "info"
              : "error";
        return (
          <Chip
            color={color}
            label={label}
            size="small"
            variant="outlined"
            sx={label === "Non completa" ? { fontWeight: 700, height: 30, "& .MuiChip-label": { px: 1.25 } } : undefined}
          />
        );
      },
    },
    {
      field: "operazione",
      headerName: "Operazione",
      minWidth: 145,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const stato = params.row.stato;

        if (params.row.pronti < params.row.previsti) {
          return <Typography color="text.secondary" variant="caption">In attesa pannelli</Typography>;
        }

        const label = stato === "In carico"
          ? "Continua"
          : stato === "Attesa ritiro"
            ? "Spedisci"
            : "Prepara";

        return <Button endIcon={<ArrowForwardRoundedIcon />} size="small" variant="outlined">{label}</Button>;
      },
    },
  ];

  return (
    <DataGrid
      columns={columns}
      disableRowSelectionOnClick
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
        "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(255,255,255,0.045)" },
      }}
    />
  );
}
