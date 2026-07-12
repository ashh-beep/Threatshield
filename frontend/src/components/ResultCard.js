export default function ResultCard({ result, reasons, url }) {
  const { score, color } = result;

  const riskLabel =
    color === "red"
      ? "High Risk 🛑"
      : color === "amber"
      ? "Likely Dangerous ⚠️"
      : color === "yellow"
      ? "Caution ⚠️"
      : "Safe ✅";

  const barColor =
    color === "red"
      ? "#ff0000"
      : color === "amber"
      ? "#ffae00"
      : color === "yellow"
      ? "#ffe900"
      : "#07bc23";

  return (
    <div
      className="rounded-xl shadow-lg p-6 mt-5 bg-white max-w-lg w-full flex flex-col items-center justify-center"
      style={{ marginTop: 32 }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: "2rem",
          margin: "0.5rem",
          color: barColor
        }}
      >
        Risk Score: <span style={{ fontSize: "2.5rem" }}>{score}/10</span>
      </div>

      <div
        style={{
          width: 180,
          height: 18,
          borderRadius: 10,
          background: "#e8e8ea",
          margin: "1rem 0",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${score * 10}%`,
            height: "100%",
            borderRadius: 10,
            background: barColor,
            transition: "width 0.5s"
          }}
        />
      </div>

      <div className="mb-3" style={{ fontSize: "1.5rem", color: barColor }}>
        {riskLabel}
      </div>

      <div className="w-full my-2">
        <p className="font-semibold mb-2 text-gray-800">Reason(s):</p>
        <ul className="list-disc px-5 text-left">
          {reasons.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3 text-xs text-gray-400 max-w-full truncate">{url}</div>
    </div>
  );
}
