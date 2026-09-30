const API = "https://api.github.com";

export async function getFile(path) {
  const url = `${API}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${path}?ref=${process.env.GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      "User-Agent": "ROCKET-Schedule",
      Accept: "application/vnd.github.v3+json"
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("GitHub GET failed: " + res.status);
  return res.json();
}

export async function putFile(path, content, message) {
  const existing = await getFile(path);
  const body = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: process.env.GITHUB_BRANCH
  };
  if (existing) body.sha = existing.sha;

  const url = `${API}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      "User-Agent": "ROCKET-Schedule",
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("GitHub PUT failed: " + res.status + " " + t);
  }
  return res.json();
}