type Props = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: Props) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#121417",
        color: "white",
        fontFamily: "Segoe UI",
      }}
    >
      <aside
        style={{
          width: 250,
          background: "#1b2027",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ color: "#ff3b30", marginTop: 0 }}>
          🚛 LoadMaster
        </h2>

        <hr />

        <p>🏠 Dashboard</p>
        <p>📦 Preparazione Magazzino</p>
        <p>🚚 Carico Camion</p>
        <p>📄 Dati ed Export</p>
      </aside>

      <main
        style={{
          flex: 1,
          padding: 30,
        }}
      >
        {children}
      </main>
    </div>
  );
}