import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

interface Props { children:ReactNode; }
interface State { error:Error|null; }

export default class AppErrorBoundary extends Component<Props,State> {
  state:State={error:null};
  static getDerivedStateFromError(error:Error):State{return{error};}
  componentDidCatch(error:Error,info:ErrorInfo):void {
    console.error("Errore React non gestito",{error,componentStack:info.componentStack});
  }
  render():ReactNode {
    if(!this.state.error)return this.props.children;
    return <Box sx={{maxWidth:760,mx:"auto",p:{xs:2,sm:4}}}>
      <Alert severity="error"><Stack sx={{gap:1.5}}>
        <Typography variant="h6">Impossibile visualizzare questa pagina</Typography>
        <Typography>{this.state.error.message||"Errore frontend non previsto"}</Typography>
        <Typography variant="caption">Il dettaglio tecnico è stato scritto nella console del browser.</Typography>
        <Button variant="contained" color="error" onClick={()=>window.location.reload()}>Ricarica SisLog</Button>
      </Stack></Alert>
    </Box>;
  }
}
