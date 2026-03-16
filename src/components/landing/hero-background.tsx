export function HeroBackground() {
  return (
    <>
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'linear-gradient(rgba(123,30,30,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(123,30,30,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 30% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 30% 50%, black, transparent)',
        }}
      />

      {/* Geometric wireframe shapes */}
      <div
        className="pointer-events-none absolute -top-24 -right-20 h-[500px] w-[500px] animate-[float_12s_ease-in-out_infinite]"
        style={{
          border: '2px solid rgba(123,30,30,0.05)',
          borderRadius: '200px 40px 200px 40px',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-36 -left-24 h-[400px] w-[400px] animate-[float_15s_ease-in-out_infinite_reverse]"
        style={{
          border: '2px solid rgba(123,30,30,0.04)',
          borderRadius: '40px 200px 40px 200px',
        }}
      />

      {/* Ambient maroon glow */}
      <div
        className="pointer-events-none absolute top-[20%] right-[15%] h-[400px] w-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(123,30,30,0.06), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </>
  );
}
