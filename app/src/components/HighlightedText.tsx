// Toont de volledige brontekst met gemarkeerde bronpassages (offsets uit de extractie).
export function HighlightedText({ text, marks }: { text: string; marks: { start: number; end: number; label: string }[] }) {
  const ms = marks.filter((m) => m.start >= 0 && m.end > m.start && m.end <= text.length).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ms.forEach((m, i) => {
    if (m.start < pos) return;
    parts.push(text.slice(pos, m.start));
    parts.push(<mark key={i} id={`pos-${m.start}`} title={m.label} className="scroll-mt-28">{text.slice(m.start, m.end)}</mark>);
    pos = m.end;
  });
  parts.push(text.slice(pos));
  return <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-navy">{parts}</div>;
}
