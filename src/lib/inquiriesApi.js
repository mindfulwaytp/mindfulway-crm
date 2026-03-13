export async function fetchInquiries() {
  const res = await fetch('/api/inquiries?action=list');
  const text = await res.text();

  console.log('fetchInquiries status:', res.status);
  console.log('fetchInquiries body:', text);

  if (!res.ok) {
    throw new Error(`Failed to fetch inquiries: ${res.status}`);
  }

  return JSON.parse(text);
}

export async function updateInquiry(id, changes) {
  const res = await fetch('/api/inquiries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update',
      id,
      changes,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to update inquiry: ${res.status}`);
  }

  return JSON.parse(text);
}

export async function createInquiry(payload) {
  const res = await fetch('/api/inquiries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      payload,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to create inquiry: ${res.status}`);
  }

  return JSON.parse(text);
}
