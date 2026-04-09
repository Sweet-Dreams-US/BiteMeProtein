"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  end_date: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const emptyEvent: Omit<Event, "id"> = {
  title: "",
  description: "",
  location: "",
  date: "",
  end_date: null,
  image_url: null,
  is_active: true,
  sort_order: 0,
};

export default function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });
    if (data) setEvents(data);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreate = async () => {
    if (!form.title || !form.date) return;
    setSaving(true);
    await supabase.from("events").insert({
      ...form,
      sort_order: events.length,
    });
    setSaving(false);
    setCreating(false);
    setForm(emptyEvent);
    fetchEvents();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    const { id, ...rest } = editing;
    await supabase
      .from("events")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    setEditing(null);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", id);
    fetchEvents();
  };

  const toggleActive = async (event: Event) => {
    await supabase
      .from("events")
      .update({ is_active: !event.is_active })
      .eq("id", event.id);
    fetchEvents();
  };

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now);

  const renderForm = (
    data: typeof form,
    setData: (d: typeof form) => void,
    onSave: () => void,
    onCancel: () => void,
    title: string
  ) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl p-8 border border-[#f0e6de] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[#5a3e36] text-xl font-semibold mb-6">{title}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Title *</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] placeholder:text-[#b0a098] focus:border-[#E8A0BF] focus:outline-none transition-colors"
              placeholder="Saturday Morning Market"
            />
          </div>

          <div>
            <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={data.description || ""}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              rows={3}
              className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] placeholder:text-[#b0a098] focus:border-[#E8A0BF] focus:outline-none resize-none transition-colors"
              placeholder="Find us at booth #14..."
            />
          </div>

          <div>
            <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Location</label>
            <input
              type="text"
              value={data.location || ""}
              onChange={(e) => setData({ ...data, location: e.target.value })}
              className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] placeholder:text-[#b0a098] focus:border-[#E8A0BF] focus:outline-none transition-colors"
              placeholder="Downtown Farmers Market"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Start Date *</label>
              <input
                type="datetime-local"
                value={data.date ? data.date.slice(0, 16) : ""}
                onChange={(e) => setData({ ...data, date: new Date(e.target.value).toISOString() })}
                className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] focus:border-[#E8A0BF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="datetime-local"
                value={data.end_date ? data.end_date.slice(0, 16) : ""}
                onChange={(e) =>
                  setData({
                    ...data,
                    end_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] focus:border-[#E8A0BF] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-1.5">Image URL</label>
            <input
              type="text"
              value={data.image_url || ""}
              onChange={(e) => setData({ ...data, image_url: e.target.value || null })}
              className="w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-4 py-3 text-[#5a3e36] placeholder:text-[#b0a098] focus:border-[#E8A0BF] focus:outline-none transition-colors"
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setData({ ...data, is_active: !data.is_active })}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                data.is_active ? "bg-[#E8A0BF]" : "bg-[#e0d5cc]"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                  data.is_active ? "left-5" : "left-1"
                }`}
              />
            </button>
            <span className="text-[#7a6a62] text-sm">Active (shown on events page)</span>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onCancel}
            className="flex-1 border border-[#e8ddd4] text-[#7a6a62] py-3 rounded-xl text-sm font-medium hover:border-[#d4c8be] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-[#E8A0BF] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#d889ad] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderEventRow = (event: Event) => (
    <div
      key={event.id}
      className={`bg-white rounded-xl p-5 border border-[#f0e6de] shadow-sm flex items-center justify-between gap-4 ${
        !event.is_active ? "opacity-50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[#5a3e36] font-semibold truncate">{event.title}</h3>
          {!event.is_active && (
            <span className="text-orange-500 text-xs font-medium">Inactive</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[#b0a098] text-xs">
          <span>{new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
          {event.location && <span>{event.location}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => toggleActive(event)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            event.is_active
              ? "bg-green-50 text-green-600"
              : "bg-orange-50 text-orange-500"
          }`}
        >
          {event.is_active ? "Active" : "Inactive"}
        </button>
        <button
          onClick={() => setEditing(event)}
          className="p-2 rounded-xl bg-[#FFF9F4] text-[#7a6a62] hover:text-[#5a3e36] border border-[#e8ddd4] text-sm transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => handleDelete(event.id)}
          className="p-2 rounded-xl bg-[#FFF9F4] text-[#b0a098] hover:text-red-500 border border-[#e8ddd4] text-sm transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-[#5a3e36] mb-2">Events</h2>
          <p className="text-[#b0a098] text-sm">
            Manage pop-ups, markets, and tasting events.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-[#E8A0BF] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d889ad] transition-colors"
        >
          + Add Event
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[#7a6a62] text-xs font-semibold uppercase tracking-wider mb-4">
            Upcoming
          </h3>
          <div className="space-y-3">{upcoming.map(renderEventRow)}</div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-[#b0a098] text-xs font-semibold uppercase tracking-wider mb-4">
            Past Events
          </h3>
          <div className="space-y-3">{past.map(renderEventRow)}</div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-[#f0e6de] shadow-sm">
          <p className="text-[#7a6a62] mb-2">No events yet.</p>
          <p className="text-[#b0a098] text-sm">Add your first event to get started.</p>
        </div>
      )}

      {/* Create Modal */}
      {creating &&
        renderForm(
          form,
          setForm as (d: typeof form) => void,
          handleCreate,
          () => {
            setCreating(false);
            setForm(emptyEvent);
          },
          "Add Event"
        )}

      {/* Edit Modal */}
      {editing &&
        renderForm(
          editing,
          setEditing as unknown as (d: typeof form) => void,
          handleUpdate,
          () => setEditing(null),
          `Edit: ${editing.title}`
        )}
    </div>
  );
}
