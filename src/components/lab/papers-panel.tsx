const PAPERS = [
  {
    id: "US 381,968",
    year: "1888",
    title: "Electromagnetic Motor",
    use: "Rotating magnetic field. The car’s actual machine. torque_Nm, I_motor_A, P_mech_W.",
  },
  {
    id: "US 462,418",
    year: "1891",
    title: "Electrical Conversion and Distribution",
    use: "Condenser charged, then dumped through a disruptive discharge. The instability. SPARK_DUMP.",
  },
  {
    id: "US 645,576 / 649,621",
    year: "1900",
    title: "Transmission of Electrical Energy",
    use: "Earth as conductor. Elevated terminal. Natural media, not Hertzian beaming.",
  },
  {
    id: "US 685,957 / 958",
    year: "1901",
    title: "Utilization of Radiant Energy",
    use: "Insulated plate charges a condenser until dump. P_radiant_W, radiantAreaM2.",
  },
  {
    id: "US 787,412",
    year: "1905",
    title: "Art of Transmitting Electrical Energy Through the Natural Mediums",
    use: "Extra coil, loose coupling, conductor = λ/4 × odd, magnification ∝ L·f / R. Core topology.",
  },
  {
    id: "US 1,119,732",
    year: "1914",
    title: "Apparatus for Transmitting Electrical Energy",
    use: "Wardenclyffe: extra coil B, cylinder B′, terminal D, ground E. earthGrip.",
  },
  {
    id: "Colorado Springs Notes",
    year: "1899",
    title: "Laboratory diary",
    use: "N=100, No. 6, 8′3″ × 8′, C 0.05–0.13 µF, R ≈ 1 Ω, pL/R written down. Preset Colorado.",
  },
  {
    id: "Increasing Human Energy",
    year: "1900",
    title: "Century Magazine essay",
    use: "Open system. Attach machinery to the wheelwork of nature. Not a closed over-unity box.",
  },
];

export function PapersPanel() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Public documents. Not seized trunks. Each block in the sim cites one of these.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {PAPERS.map((p) => (
          <li
            key={p.id}
            className="rounded-md bg-raised p-4 shadow-[0_0_0_1px_rgba(230,228,220,0.06)]"
          >
            <p className="font-mono text-xs text-accent">
              {p.id} · {p.year}
            </p>
            <h3 className="mt-1 font-display text-lg font-medium tracking-tight">{p.title}</h3>
            <p className="mt-2 text-sm text-muted">{p.use}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
