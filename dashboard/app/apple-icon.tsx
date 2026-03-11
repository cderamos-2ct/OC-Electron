import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(160deg, #0a161d 0%, #10212c 55%, #0c1d27 100%)",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #ff7a1a, #ffb36a)",
            color: "#08121a",
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-0.08em",
          }}
        >
          OC
        </div>
      </div>
    ),
    size,
  );
}
