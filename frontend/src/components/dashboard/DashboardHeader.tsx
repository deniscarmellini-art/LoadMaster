import { Avatar, Box, Paper, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import essepiLogo from "../../assets/logo-essepi-finestre-xlam.jpg";
import { demoBranding, isDemoEnvironment } from "../../services/demoBranding";

export default function DashboardHeader() {
  const theme = useTheme();
  const narrowPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const landscapePhone = useMediaQuery("(max-width:950px) and (max-height:500px)");
  const mobile = narrowPhone || landscapePhone;

  if (mobile) {
    return (
      <Paper component="header" elevation={0} sx={{ border: 1, borderColor: "divider", mb: 1, overflow: "hidden", p: 1 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          {isDemoEnvironment ? (
            <Box sx={{ alignItems: "center", bgcolor: "primary.main", borderRadius: 1.5, color: "primary.contrastText", display: "flex", fontSize: ".67rem", fontWeight: 900, height: 42, justifyContent: "center", letterSpacing: .4, lineHeight: 1.15, textAlign: "center", width: 58 }}>
              SisLog<br />DEMO
            </Box>
          ) : (
            <Box alt="Essepi - finestre & xlam" component="img" src={essepiLogo} sx={{ aspectRatio: "1 / 1", height: 48, objectFit: "contain" }} />
          )}
          <Box sx={{ minWidth: 0, textAlign: "center" }}>
            <Typography component="h1" noWrap sx={{ fontSize: "1.45rem", fontWeight: 900, lineHeight: 1.1 }}>
              {demoBranding.application}
            </Typography>
            <Typography noWrap color="text.secondary" sx={{ fontSize: ".7rem", mt: .25 }}>
              Gestione elementi, pacchi e spedizioni
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: "primary.main", height: 38, width: 38 }}>U</Avatar>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper component="header" elevation={0} sx={{ border: 1, borderColor: "divider", mb: 1, overflow: "hidden", p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ alignItems: "center", display: "grid", gridTemplateColumns: "1fr auto 1fr", minHeight: 48 }}>
        <Box sx={{ alignItems: "center", display: "flex", justifySelf: "start" }}>
          {isDemoEnvironment ? (
            <Box sx={{ alignItems: "center", bgcolor: "primary.main", borderRadius: 2, color: "primary.contrastText", display: "flex", fontSize: { xs: ".82rem", md: "1rem" }, fontWeight: 900, height: { xs: 58, sm: 70, md: 84 }, justifyContent: "center", letterSpacing: .7, lineHeight: 1.15, textAlign: "center", width: { xs: 66, sm: 80, md: 96 } }}>
              SisLog<br />DEMO
            </Box>
          ) : (
            <Box alt="Essepi - finestre & xlam" component="img" src={essepiLogo} sx={{ aspectRatio: "1 / 1", display: "block", height: { xs: 66, sm: 78, md: 94 }, objectFit: "contain", width: "auto" }} />
          )}
        </Box>
        <Box sx={{ justifySelf: "center", textAlign: "center" }}>
          <Typography component="h1" sx={{ fontSize: { xs: "2.28rem", md: "2.88rem" }, fontWeight: 800, letterSpacing: 1.2, lineHeight: 1.05 }}>
            {demoBranding.application}
          </Typography>
          <Typography component="p" sx={{ color: "#A0A8B5", fontSize: { xs: "1.02rem", md: "1.3rem" }, lineHeight: 1.2, mt: "5px" }}>
            Gestione elementi, pacchi e spedizioni
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
    </Paper>
  );
}
