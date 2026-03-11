import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  getLobsterboardTemplatePreviewPath,
  readLobsterboardTemplates,
} from "@/lib/lobsterboard-files";

export const runtime = "nodejs";

function contentTypeFromFileName(fileName: string) {
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (fileName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}

function placeholderSvg(templateId: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08121a" />
      <stop offset="100%" stop-color="#102331" />
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)" rx="24" />
  <rect x="64" y="64" width="1072" height="547" rx="20" fill="#0d1b26" stroke="#254257" />
  <text x="90" y="126" fill="#ff7a1a" font-family="sans-serif" font-size="22" letter-spacing="4">LOBSTERBOARD TEMPLATE</text>
  <text x="90" y="186" fill="#f3f5f7" font-family="sans-serif" font-size="52" font-weight="700">${templateId}</text>
  <text x="90" y="240" fill="#91a1af" font-family="sans-serif" font-size="26">Preview image not bundled. Template can still be imported.</text>
  <rect x="90" y="304" width="300" height="120" rx="18" fill="#102331" stroke="#254257" />
  <rect x="420" y="304" width="300" height="120" rx="18" fill="#102331" stroke="#254257" />
  <rect x="750" y="304" width="300" height="120" rx="18" fill="#102331" stroke="#254257" />
  <rect x="90" y="456" width="960" height="100" rx="18" fill="#102331" stroke="#254257" />
</svg>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const templateMeta = readLobsterboardTemplates().find(
      (template) => template.id === id,
    );
    const previewPath = getLobsterboardTemplatePreviewPath(
      id,
      templateMeta?.preview,
    );

    if (fs.existsSync(previewPath)) {
      const file = fs.readFileSync(previewPath);
      return new NextResponse(file, {
        headers: {
          "Content-Type": contentTypeFromFileName(previewPath),
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    return new NextResponse(placeholderSvg(id), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
