import { ImageResponse } from 'next/og';
import { OG_IMAGE_BASE64 } from './_og-image-data';

export const alt = 'Ship Safe — Find Security Vulnerabilities Before You Ship';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default function Image() {
  return new ImageResponse(
    (
      <img
        src={`data:image/jpeg;base64,${OG_IMAGE_BASE64}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ),
    { ...size },
  );
}
