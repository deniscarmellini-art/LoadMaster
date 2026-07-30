import { importaExcel } from "../services/excelImport";
import type { Commessa } from "../types/excel";

interface Props {
  onImported: (commessa: Commessa) => void;
}

function ImportExcel({ onImported }: Props) {
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
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
    </div>
  );
}

export default ImportExcel;






























































































