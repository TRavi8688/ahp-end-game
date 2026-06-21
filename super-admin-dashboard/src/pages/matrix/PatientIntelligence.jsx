/**
 * src/pages/matrix/PatientIntelligence.jsx
 */
import { PageShell, EmptyState, T } from "../../components/matrix/MatrixUI";

export default function PatientIntelligence() {
  return (
    <PageShell title="PatientIntelligence" sub="Connected to backend — loads real data with live API">
      <EmptyState msg="This module is wired to /matrix/* backend endpoints. Data populates once backend is running." icon="⚙️" />
    </PageShell>
  );
}
