/**
 * src/pages/matrix/AutoAssignmentEngine.jsx
 */
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, T } from "../../components/matrix/MatrixUI";

const FLOW = [
  { step:"Ticket Created",     color:T.indigo,  detail:"Via Patient App · Hospital Portal · Pharmacy · Lab · Internal" },
  { step:"AI Category Detection", color:T.violet, detail:"NLP classifies: category + priority + urgency score" },
  { step:"Department Queue",   color:T.cyan,    detail:"Support · Finance · Engineering · Onboarding · Data · Verification" },
  { step:"Load Balancer",      color:T.emerald, detail:"Scans all online L1 agents · checks shift, leave, capacity, skills" },
  { step:"Agent Bucket",       color:T.amber,   detail:"Selects agent with lowest open ticket count in correct team" },
  { step:"Assignment",         color:T.rose,    detail:"Ticket assigned · SLA timer starts · Agent notified instantly" },
];

export default function AutoAssignmentEngine() {
  return (
    <PageShell title="Auto-Assignment Engine" sub="Zero manual assignment — every ticket automatically distributed">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Flow diagram */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:18 }}>
          <div style={{ fontSize:11, color:T.textDim, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>Assignment Flow</div>
          {FLOW.map((f, i) => (
            <div key={f.step} style={{ display:"flex", gap:12, marginBottom: i < FLOW.length-1 ? 0 : 0 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:`${f.color}18`, border:`1px solid ${f.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:f.color, flexShrink:0 }}>{i+1}</div>
                {i < FLOW.length-1 && <div style={{ width:1, flex:1, minHeight:24, background:T.border, margin:"4px 0" }}/>}
              </div>
              <div style={{ paddingTop:6, paddingBottom: i < FLOW.length-1 ? 16 : 0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:2 }}>{f.step}</div>
                <div style={{ fontSize:11, color:T.textDim }}>{f.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Team routing */}
        <div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:11, color:T.textDim, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>Team Routing Map</div>
            {[
              ["billing",          "Finance Team",      T.emerald],
              ["technical",        "Engineering Team",  T.cyan],
              ["onboarding",       "Onboarding Team",   T.violet],
              ["pharmacy_support", "Pharmacy Support",  T.amber],
              ["lab_support",      "Lab Support",       T.rose],
              ["data",             "Data Team",         T.indigo],
              ["staff_access",     "IAM / HR Team",     T.slate],
            ].map(([cat, team, color]) => (
              <div key={cat} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:11, color:T.textMid, fontFamily:"monospace" }}>{cat}</span>
                <span style={{ fontSize:12, fontWeight:600, color }}>{team}</span>
              </div>
            ))}
          </div>

          <div style={{ background:`${T.indigo}08`, border:`1px solid ${T.indigo}20`, borderRadius:12, padding:14 }}>
            <div style={{ fontSize:11, color:T.indigoL, fontWeight:700, marginBottom:6 }}>Assignment Factors</div>
            {["Current open ticket count","Priority weight of existing tickets","Shift status (online/break/leave)","Daily ticket limit capacity","Skill match for ticket category","SLA breach risk score"].map((f) => (
              <div key={f} style={{ fontSize:11, color:T.textMid, padding:"3px 0", display:"flex", gap:8 }}>
                <span style={{ color:T.indigo }}>→</span>{f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
