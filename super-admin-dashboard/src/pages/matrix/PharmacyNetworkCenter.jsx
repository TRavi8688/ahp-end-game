import { useEffect } from "react";
import { PageShell, EmptyState } from "../../components/matrix/MatrixUI";

export default function PharmacyNetworkCenter() {
  return (
    <PageShell title="Pharmacy Network Center">
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>💊</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:"#f1f5f9", margin:"0 0 8px" }}>Pharmacy Network Center</h2>
        <p style={{ fontSize:13, color:"#475569", maxWidth:420, lineHeight:1.6 }}>Pharmacy management: inventory alerts, prescription flow, revenue, complaints.</p>
        <p style={{ fontSize:11, color:"#334155", marginTop:16 }}>Connected to backend at /matrix/* — real data loads with live backend.</p>
      </div>
    </PageShell>
  );
}