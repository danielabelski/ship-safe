import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const alt = 'Ship Safe — Find Security Vulnerabilities Before You Ship';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default function Image() {
  const data = readFileSync(join(process.cwd(), 'public', 'og-shipsafe.jpg'));
  const base64 = `data:image/jpeg;base64,${data.toString('base64')}`;

  return new ImageResponse(
    (
      <img
        src={base64}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ),
    { ...size },
  );
}
