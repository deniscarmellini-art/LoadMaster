import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { Avatar, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";

interface DashboardHeaderProps {
  isImporting: boolean;
  onImportClick: () => void;
  onOpenLabels: () => void;
  onOpenScanning: () => void;
  onOpenWarehouse: () => void;
  onOpenSettings: () => void;
  onOpenLoading: () => void;
  onOpenHistory: () => void;
}

const navigation = [
  { label: "Stampa etichette", icon: <PrintOutlinedIcon />, page: "labels" },
  { label: "Magazzino", icon: <Inventory2OutlinedIcon />, page: "warehouse" },
  { label: "Scansione pannelli", icon: <QrCodeScannerOutlinedIcon />, page: "scanning" },
  { label: "Carico camion", icon: <LocalShippingOutlinedIcon />, page: "loading" },
  { label: "Storico", icon: <HistoryOutlinedIcon /> },
  { label: "Impostazioni", icon: <SettingsOutlinedIcon />, page: "settings" },
];

export default function DashboardHeader({ isImporting, onImportClick, onOpenLabels, onOpenScanning, onOpenWarehouse, onOpenSettings, onOpenLoading, onOpenHistory }: DashboardHeaderProps) {
  return (
    <Paper
      component="header"
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        mb: 2,
        overflow: "hidden",
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Box sx={{ alignItems: "center", display: "grid", gridTemplateColumns: "1fr auto 1fr", minHeight: 48 }}>
        <Box />
        <Typography
          component="h1"
          sx={{ fontSize: { xs: "1.65rem", md: "2rem" }, fontWeight: 800, letterSpacing: 1.2, textAlign: "center" }}
        >
          GESTIONE CARICHI
        </Typography>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", justifySelf: "end" }}>
          <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "right" }}>
            <Typography sx={{ fontWeight: 700 }} variant="body2">Utente</Typography>
            <Typography color="text.secondary" variant="caption">Operatore</Typography>
          </Box>
          <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>U</Avatar>
        </Stack>
      </Box>

      <Box
        component="nav"
        sx={{
          bgcolor: "rgba(0, 0, 0, 0.2)",
          border: 1,
          borderColor: "divider",
          borderRadius: 2.5,
          display: "flex",
          flexWrap: "nowrap",
          justifyContent: "space-between",
          gap: 0,
          mt: 1.5,
          p: 0.75,
        }}
      >
        <Button
          disabled={isImporting}
          onClick={onImportClick}
          startIcon={isImporting ? <CircularProgress color="inherit" size={18} /> : <UploadFileOutlinedIcon />}
          variant="text"
          sx={{
            bgcolor: "transparent",
            color: "text.secondary",
            flex: "0 1 auto",
            height: 42,
            minWidth: 0,
            whiteSpace: "nowrap",
            "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "text.primary" },
          }}
        >
          {isImporting ? "Importazione…" : "Importa Excel"}
        </Button>
        {navigation.map((item) => (
          <Button
            key={item.label}
            onClick={item.label === "Storico" ? onOpenHistory : item.page === "labels" ? onOpenLabels : item.page === "warehouse" ? onOpenWarehouse : item.page === "scanning" ? onOpenScanning : item.page === "settings" ? onOpenSettings : item.page === "loading" ? onOpenLoading : undefined}
            startIcon={item.icon}
            variant="text"
            sx={{
              bgcolor: "transparent",
              color: "text.secondary",
              flex: "0 1 auto",
              height: 42,
              minWidth: 0,
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "text.primary" },
            }}
          >
            {item.label}
          </Button>
        ))}
      </Box>
    </Paper>
  );
}
