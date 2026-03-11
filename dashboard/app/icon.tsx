import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            "radial-gradient(circle at 20% 20%, rgba(255, 161, 79, 0.9), transparent 28%), linear-gradient(160deg, #08121a 0%, #10212c 55%, #0a161d 100%)",
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "8px solid rgba(255,255,255,0.14)",
            boxShadow: "0 0 0 18px rgba(99, 211, 189, 0.12)",
            background: "linear-gradient(135deg, #ff7a1a, #ffb36a)",
            color: "#08121a",
            fontSize: 148,
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
