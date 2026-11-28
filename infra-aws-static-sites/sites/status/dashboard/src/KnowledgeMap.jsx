import * as React from "react";
import { ChevronDown } from "lucide-react";

const feed = "https://raw.githubusercontent.com/shdkej/infinity/main/data/promotion-index.json";
const labels = { all: "전체", reflected: "Wiki 반영", pending_promotion: "승격 대기", not_applicable: "위키 대상 아님" };

function category(entry) {
  if (Object.hasOwn(labels, entry.promotion_state) && entry.promotion_state !== "all") return entry.promotion_state;
  if (entry.wiki_reflected) return "reflected";
  return entry.status === "selected" ? "pending_promotion" : "not_applicable";
}

export function KnowledgeMap({ refresh }) {
  const [model, setModel] = React.useState(null);
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState("all");
  const [limit, setLimit] = React.useState(12);
  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(feed, { signal: controller.signal, cache: "no-cache" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.entries)) throw new Error();
        setModel(data);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    load();
    const timer = window.setInterval(load, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  const entries = model?.entries || [];
  const counts = { all: entries.length, reflected: 0, pending_promotion: 0, not_applicable: 0 };
  for (const entry of entries) counts[category(entry)]++;
  const visible = filter === "all" ? entries : entries.filter(entry => category(entry) === filter);
  function select(value) { setFilter(value); setLimit(12); }
  return <section className="detail-screen kl-map">
    <h1>KL 반영 맵</h1>
    {failed && <p role="status">KL 데이터를 불러오지 못했습니다. 상단 새로고침으로 다시 시도해 주세요.</p>}
    {!model && !failed && <p role="status">문서를 불러오는 중입니다.</p>}
    {model && <>
      <p>Knowledge Lab 문서 {entries.length}개 · {new Date(model.generated_at).toLocaleString("ko-KR")} 갱신</p>
      <div className="kl-filters" role="group" aria-label="반영 상태">
        {Object.entries(labels).map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => select(key)}>
          <span>{key !== "all" && <i aria-hidden="true" className={'kl-color ' + key} />}{label}</span>
          <span className="kl-count">{counts[key]}</span>
        </button>)}
      </div>
      <div className="kl-field" aria-label="문서별 반영 상태">
        {entries.map(entry => <button key={entry.source} type="button" className={'kl-color ' + category(entry)}
          data-dimmed={filter !== "all" && filter !== category(entry)} title={labels[category(entry)] + " · " + entry.source}
          aria-label={labels[category(entry)] + " · " + entry.source} onClick={() => select(category(entry))} />)}
      </div>
      <h2>{labels[filter]} 문서 {visible.length}개</h2>
      {visible.slice(0, limit).map(entry => <article className="kl-file" key={entry.source}>
        <a href={"https://github.com/shdkej/knowledge-lab/blob/main/" + entry.source} target="_blank" rel="noreferrer" className="kl-source" title={entry.source}>
          <strong>{entry.source.split("/").pop()}</strong>
          {entry.source.includes("/") && <span>{entry.source.slice(0, entry.source.lastIndexOf("/"))}/</span>}
        </a>
        <small>{labels[category(entry)]} · {entry.status}</small>
        <p>{entry.reason}</p>
        {(entry.promotion_targets || []).map(path => <a key={path} href={"https://shdkej.com/agent-wiki" + path} target="_blank" rel="noreferrer">Wiki · {path}</a>)}
        {!entry.promotion_targets?.length && entry.promotion_reason !== entry.reason && <small>{entry.promotion_reason || entry.promotion_target_note}</small>}
      </article>)}
      {visible.length > limit && <button className="kl-more" onClick={() => setLimit(limit + 48)}>문서 더 보기 <ChevronDown size={15} aria-hidden="true" /></button>}
    </>}
  </section>;
}
