import { useEffect, useState } from "react";
import { fetchInquiries, fetchInquiriesSince } from "../lib/inquiriesApi";

const CACHE_KEY = 'mw_inquiries_cache';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(inquiries, lastSyncedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ inquiries, lastSyncedAt }));
  } catch (e) {
    console.warn('Cache save failed:', e);
  }
}

function mergeInquiries(cached, changed) {
  const map = Object.fromEntries(cached.map((i) => [i.id, i]));
  changed.forEach((i) => { map[i.id] = i; });
  return Object.values(map).sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
  );
}

function Pipeline() {

  const [inquiries, setInquiries] = useState([]);

  useEffect(() => {
    async function load() {
      const cache = loadCache();
      if (cache) {
        setInquiries(cache.inquiries);
        const changed = await fetchInquiriesSince(cache.lastSyncedAt);
        if (changed.length > 0) {
          const merged = mergeInquiries(cache.inquiries, changed);
          setInquiries(merged);
          saveCache(merged, Date.now());
        }
      } else {
        const data = await fetchInquiries();
        setInquiries(data);
        saveCache(data, Date.now());
      }
    }

    load();
  }, []);

  return (
    <div>
      <h1>Inquiry Pipeline</h1>

      {inquiries.map((inq) => (
        <div key={inq.id}>
          {inq.name} — {inq.status}
        </div>
      ))}
    </div>
  );
}

export default Pipeline;
