import { Box, Container, Typography } from "@mui/material";

type Props = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: Props) {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      {import.meta.env.VITE_SISLOG_TEST && <Box component="header" sx={{ position: "sticky", top: 0, zIndex: 1200, bgcolor: "warning.main", color: "warning.contrastText", py: .5, px: 2, textAlign: "center", fontWeight: 800, fontSize: ".8rem", "@media print": { display: "none" } }}>AMBIENTE TEST</Box>}
      <Box component="main" sx={{ py: { xs: 1.5, md: 2.5 } }}>
        <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 3 } }}>{children}</Container>
      </Box>
      <Box
        component="footer"
        sx={{
          borderColor: "rgba(255,255,255,0.05)",
          borderTop: 1,
          color: "text.secondary",
          display: "grid",
          fontSize: "0.68rem",
          gap: { xs: 0.5, sm: 1 },
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          opacity: 0.46,
          px: { xs: 2, sm: 3 },
          py: 1.1,
          textAlign: { xs: "center", sm: "left" },
        }}
      >
        <Typography sx={{ fontSize: "inherit" }}>Sistema Logistico</Typography>
        <Typography sx={{ fontSize: "inherit", textAlign: "center" }}>Versione 1.0 By C.D.</Typography>
        <Typography sx={{ fontSize: "inherit", textAlign: { xs: "center", sm: "right" } }}>© 2026 ESSEPI S.r.l.</Typography>
      </Box>
    </Box>
  );
}
