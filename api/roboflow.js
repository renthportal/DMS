export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { image } = req.body;
    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ROBOFLOW_API_KEY not set' });
    if (!image)  return res.status(400).json({ error: 'No image provided' });

    const response = await fetch(
      `https://detect.roboflow.com/pedestrian-cell-phone-detection/14?api_key=${apiKey}&confidence=15&overlap=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: image
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
