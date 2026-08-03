import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { Avatar, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";

import essepiLogo from "../../assets/logo-essepi-finestre-xlam.jpg";

interface DashboardHeaderProps {
  isImporting: boolean;
  onImportClick: () => void;
  onOpenLabels: () => void;
  onOpenScanning: () => void;
  onOpenWarehouse: () => void;
  onOpenSettings: () => void;
  onOpenLoading: () => void;
  onOpenTransports: () => void;
  onOpenHistory: () => void;
}

const navigation = [
  { label: "Stampa etichette", icon: <PrintOutlinedIcon />, page: "labels" },
  { label: "Scansione pannelli", icon: <QrCodeScannerOutlinedIcon />, page: "scanning" },
  { label: "Magazzino", icon: <Inventory2OutlinedIcon />, page: "warehouse" },
  { label: "Carico camion", icon: <LocalShippingOutlinedIcon />, page: "loading" },
  { label: "Trasporti", icon: <RouteOutlinedIcon />, page: "transports" },
  { label: "Storico", icon: <HistoryOutlinedIcon /> },
  { label: "Impostazioni", icon: <SettingsOutlinedIcon />, page: "settings" },
];

export default function DashboardHeader({ isImporting, onImportClick, onOpenLabels, onOpenScanning, onOpenWarehouse, onOpenSettings, onOpenLoading, onOpenTransports, onOpenHistory }: DashboardHeaderProps) {
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
        <Box sx={{ alignItems: "center", display: "flex", justifySelf: "start" }}>
          <Box
            alt="Essepi - finestre & xlam"
            component="img"
            src={essepiLogo}
            sx={{ aspectRatio: "1 / 1", display: "block", height: { xs: 66, sm: 78, md: 94 }, objectFit: "contain", width: "auto" }}
          />
        </Box>
        <Box sx={{ justifySelf: "center", textAlign: "center" }}>
          <Typography
            component="h1"
            sx={{ fontSize: { xs: "2.28rem", md: "2.88rem" }, fontWeight: 800, letterSpacing: 1.2, lineHeight: 1.05 }}
          >
            Sistema Logistico
          </Typography>
          <Typography
            component="p"
            sx={{ color: "#A0A8B5", fontSize: { xs: "1.02rem", md: "1.3rem" }, lineHeight: 1.2, mt: "5px" }}
          >
            Gestione pannelli, pacchi e spedizioni
          </Typography>
        </Box>
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
          flexWrap: { xs: "wrap", lg: "nowrap" },
          justifyContent: { xs: "center", lg: "space-between" },
          gap: { xs: 0.25, lg: 0 },
          mt: 1.5,
          p: 0.5,
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
            height: 38,
            minWidth: 0,
            whiteSpace: "nowrap",
            "& .MuiButton-startIcon": { mr: 1.25 },
            "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "text.primary" },
          }}
        >
          {isImporting ? "Importazione…" : "Importa Excel"}
        </Button>
        {navigation.map((item) => (
          <Button
            key={item.label}
            onClick={item.label === "Storico" ? onOpenHistory : item.page === "labels" ? onOpenLabels : item.page === "warehouse" ? onOpenWarehouse : item.page === "scanning" ? onOpenScanning : item.page === "settings" ? onOpenSettings : item.page === "loading" ? onOpenLoading : item.page === "transports" ? onOpenTransports : undefined}
            startIcon={item.icon}
            variant="text"
            sx={{
              bgcolor: "transparent",
              color: "text.secondary",
              flex: "0 1 auto",
              height: 38,
              minWidth: 0,
              whiteSpace: "nowrap",
              "& .MuiButton-startIcon": { mr: 1.25 },
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
