import { putFile } from "../../lib/github";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id, data } = req.body;
  if (!id || !data) return res.status(400).json({ error: "id and data required" });

  try {
    const content = JSON.stringify(data, null, 2);
    await putFile(`schedules/${id}.json`, content, `update schedule ${id}`);
    res.json({ ok: true, path: `schedules/${id}.json` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}