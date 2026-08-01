import { importaExcel } from "../services/excelImport";
import type { Commessa } from "../types/excel";

interface Props {
  onImported: (commessa: Commessa) => void;
  inputId?: string;
}

function ImportExcel({ onImported, inputId }: Props) {
  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const dati = await importaExcel(file);

      onImported(dati);

    } catch (errore) {
      console.error(errore);
      alert("Errore durante l'importazione del file.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <input
        id={inputId}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
    </div>
  );
}

export default ImportExcel;






























































































