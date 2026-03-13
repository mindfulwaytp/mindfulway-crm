const API_URL = 'https://script.google.com/macros/s/AKfycbynKe5GKkqUs-nKq9JRlBMJ0TrltZtrSrkt0f4z8QIUfMmdau14kkdct_3b-kK67YE/exec';

export async function fetchInquiries() {
  const res = await fetch(`${API_URL}?action=list`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch inquiries: ${res.status}`);
  }

  return res.json();
}

export async function updateInquiry(id, changes) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'update',
      id,
      changes,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update inquiry: ${res.status}`);
  }

  return res.json();
}

export async function createInquiry(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'create',
      payload,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create inquiry: ${res.status}`);
  }

  return res.json();
}
