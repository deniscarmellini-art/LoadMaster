import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { Chip } from "@mui/material";
import type { Camion } from "../../models/Camion";

interface Props {
    rows: Camion[];
}

export default function DashboardGrid({ rows }: Props) {

    const columns: GridColDef[] = [

        {
            field: "commessa",
            headerName: "Commessa",
            width: 110
        },

        {
            field: "cliente",
            headerName: "Cliente",
            flex: 1,
            minWidth: 180
        },

        {
            field: "camion",
            headerName: "Camion",
            width: 90
        },

        {
            field: "previsti",
            headerName: "Previsti",
            width: 90,
            type: "number"
        },

        {
            field: "pronti",
            headerName: "Pronti",
            width: 90,
            type: "number"
        },

        {
            field: "caricati",
            headerName: "Caricati",
            width: 95,
            type: "number"
        },

        {
            field: "mancanti",
            headerName: "Mancanti",
            width: 100,
            type: "number"
        },

        {
            field: "peso",
            headerName: "Peso (kg)",
            width: 110,
            type: "number",
            valueFormatter: (value) =>
                Number(value).toLocaleString("it-IT", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1
                })
        },

        {
            field: "volume",
            headerName: "Volume (m³)",
            width: 110,
            type: "number",
            valueFormatter: (value) =>
                Number(value).toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })
        },

        {
            field: "stato",
            headerName: "Stato",
            flex: 1,
            minWidth: 180,

            renderCell: (params) => {

                const stato = params.value as string;

                let color:
                    | "default"
                    | "success"
                    | "warning"
                    | "info"
                    | "error" = "default";

                switch (stato) {

                    case "Non completa":
                        color = "error";
                        break;

                    case "Completa da caricare":
                        color = "success";
                        break;

                    case "In carico":
                        color = "warning";
                        break;

                    case "Attesa ritiro":
                        color = "info";
                        break;

                    case "Evasa":
                        color = "default";
                        break;
                }

                return (
                    <Chip
                        label={stato}
                        color={color}
                        size="small"
                    />
                );
            }
        }

    ];

    return (

        <DataGrid

            rows={rows}

            columns={columns}

            disableRowSelectionOnClick

            pageSizeOptions={[10, 25, 50]}

            initialState={{
                pagination: {
                    paginationModel: {
                        pageSize: 25
                    }
                }
            }}

            sx={{
                backgroundColor: "white",
                borderRadius: 2
            }}

        />

    );

}