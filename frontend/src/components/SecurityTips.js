const tips = [
  "Never enter your password after clicking a suspicious link.",
  "Check for HTTPS and a valid domain before signing in.",
  "Beware of links with lots of dashes or weird characters.",
  "Don't trust warnings or threats to create urgency.",
  "If you're unsure, ask your IT/security team!"
];

export default function SecurityTips() {
  return (
    <div className="mt-8 w-full text-center">
      <div className="text-white text-lg font-semibold mb-2">
        🔐 Gatekeeper Security Tips
      </div>
      <ul className="inline-block bg-blue-900 rounded-2xl px-6 py-4 shadow border border-blue-400">
        {tips.map(tip => (
          <li className="text-white my-2" key={tip}>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
