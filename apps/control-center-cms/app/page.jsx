"use client";

import { useEffect, useMemo, useState } from "react";

const defaultForm = {
  surface: "family-wedding",
  field_key: "notice",
  value: "가족끼리만 작게 모이는 자리라 별도로 모시지 못하는 점 너른 양해 부탁드립니다.",
  status: "draft"
};

const surfaces = [
  { value: "family-wedding", label: "Family Wedding 안내장" },
  { value: "travel-dashboard", label: "Travel Dashboard" },
  { value: "status-control", label: "Status Control Center" }
];

const fields = [
  { value: "notice", label: "NOTICE" },
  { value: "body_intro", label: "본문 도입" },
  { value: "og_description", label: "공유 미리보기" },
  { value: "banner", label: "상단 배너" }
];

export default function Page() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0, draft: 0, ready: 0, published: 0 }
    );
  }, [items]);

  async function loadItems() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/items", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "목록을 불러오지 못했습니다.");
      setItems(payload.items || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(defaultForm);
  }

  async function saveItem(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const target = editingId ? `/api/items/${editingId}` : "/api/items";
      const response = await fetch(target, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "저장하지 못했습니다.");
      setMessage(editingId ? "수정했습니다." : "새 항목을 만들었습니다.");
      resetForm();
      await loadItems();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      surface: item.surface,
      field_key: item.field_key,
      value: item.value,
      status: item.status
    });
    setMessage("편집 모드입니다.");
  }

  async function removeItem(id) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "삭제하지 못했습니다.");
      setMessage("삭제했습니다.");
      if (editingId === id) resetForm();
      await loadItems();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Control Center CMS</p>
          <h1>Operational Edits</h1>
          <p className="dek">
            대시보드와 정적 페이지의 반복 수정값을 웹에서 직접 만들고 고칩니다.
            현재는 Supabase scratch 데이터에 대한 CRUD MVP이며, 공개 페이지 publish는
            별도 승인 단계로 분리합니다.
          </p>
        </div>
        <div className="status-pill">
          <b>Live Data</b>
          <span>{counts.total} records · draft {counts.draft} · ready {counts.ready}</span>
        </div>
      </header>

      <section className="grid">
        <form className="panel form" onSubmit={saveItem}>
          <h2>{editingId ? "Edit CMS Record" : "Create CMS Record"}</h2>
          <div className="field">
            <label htmlFor="surface">Surface</label>
            <select
              id="surface"
              value={form.surface}
              onChange={(event) => updateForm("surface", event.target.value)}
            >
              {surfaces.map((surface) => (
                <option key={surface.value} value={surface.value}>
                  {surface.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="field_key">Field</label>
            <select
              id="field_key"
              value={form.field_key}
              onChange={(event) => updateForm("field_key", event.target.value)}
            >
              {fields.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              <option value="draft">draft</option>
              <option value="ready">ready</option>
              <option value="published">published</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="value">Value</label>
            <textarea
              id="value"
              value={form.value}
              onChange={(event) => updateForm("value", event.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="actions">
            <button type="submit" disabled={saving}>
              {editingId ? "Update" : "Create"}
            </button>
            <button type="button" className="secondary" onClick={resetForm} disabled={saving}>
              Reset
            </button>
            <button type="button" className="secondary" onClick={loadItems} disabled={saving}>
              Refresh
            </button>
          </div>
          <div className="toast" aria-live="polite">
            {message}
          </div>
        </form>

        <section className="panel">
          <h2>Records</h2>
          {loading ? (
            <div className="empty">Loading records...</div>
          ) : items.length === 0 ? (
            <div className="empty">아직 CMS record가 없습니다.</div>
          ) : (
            <div className="items">
              {items.map((item) => (
                <article className="item" key={item.id}>
                  <div className="item-head">
                    <div>
                      <p className="item-title">
                        {item.surface} / {item.field_key}
                      </p>
                      <p className="meta">
                        {item.status} · {new Date(item.updated_at).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="actions">
                      <button type="button" className="secondary" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => removeItem(item.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="value">{item.value}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
