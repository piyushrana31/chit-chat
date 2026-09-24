const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchMe(token) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Session expired');
  return data;
}

export async function findUser(username, token) {
  const response = await fetch(`${API_URL}/api/auth/users/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'User not found');
  return data.user;
}
