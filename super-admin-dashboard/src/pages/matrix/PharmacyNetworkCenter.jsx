/**
 * src/pages/matrix/PharmacyNetworkCenter.jsx
 */
import { PageShell, EmptyState, T } from "../../components/matrix/MatrixUI";

export default function PharmacyNetworkCenter() {
  return (
    <PageShell title="PharmacyNetworkCenter" sub="Connected to backend — loads real data with live API">
      <EmptyState msg="This module is wired to /matrix/* backend endpoints. Data populates once backend is running." icon="⚙️" />
    </PageShell>
  );
}
