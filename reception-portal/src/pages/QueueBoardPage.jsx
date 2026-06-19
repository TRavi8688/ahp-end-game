import LiveQueueBoard from "../components/reception/LiveQueueBoard";
import DoctorAvailabilityView from "../components/reception/DoctorAvailabilityView";
import { useAuth } from "../hooks/useAuth";

const QueueBoardPage = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Queue Board</h1>
        <p style={s.subtitle}>Manage today's live patient queue</p>
      </div>
      <div style={s.grid}>
        <div style={s.main}>
          <LiveQueueBoard hospitalId={hospitalId} />
        </div>
        <div style={s.side}>
          <DoctorAvailabilityView hospitalId={hospitalId} />
        </div>
      </div>
    </div>
  );
};

const s = {
  page: { padding: "24px 20px", maxWidth: 1200, margin: "0 auto" },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 800, color: "#111827", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: 20,
    alignItems: "start",
  },
  main: {},
  side: {},
};

export default QueueBoardPage;
